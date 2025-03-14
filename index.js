const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser'); // Include cookie-parser
const { createUserTable, insertUser, findUserByUsername } = require('./models/user.js');
require('dotenv').config();
const app = express();


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser()); // Use cookie-parser middleware
app.use(express.static(path.join(__dirname, 'public')));

// Initialize the database
createUserTable();

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'templates/index.html');  // Path to your HTML file
  res.sendFile(filePath);  // Send the HTML file as response
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '/templates/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '/templates/register.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ username: user.username }, 'your_jwt_secret', { expiresIn: '1h' }); // Sign token with expiry
      res.cookie('token', token, { httpOnly: true, secure: true }); // Set token in cookie
      res.redirect('/getUsername'); // Redirect to users.html
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error querying the database:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/getUsername', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '/templates/users.html'));
});

// Middleware function to verify JWT token
function verifyToken(req, res, next) {
  const token = req.cookies.token; // Extract token from cookie
  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.sendStatus(403); // Send 403 for token verification failure
    }
    req.username = user.username;
    next();
  });
}

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);
  try {
    await insertUser(username, email, hashedPassword);
    res.sendFile(path.join(__dirname, '/templates/login.html'));
  } catch (error) {
    console.error('Error querying the database:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// mpesa stk push
const generateToken = async (req, res, next) => {
  const KEY=process.env.MPESA_CONSUMER_KEY;
  const SECRET=process.env.MPESA_CONSUMER_SECRET;
  const auth = new Buffer.from(`${KEY}:${SECRET}`).toString('base64');

  await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: {
          authorization: `Basic ${auth}`
      },
  }
  ).then((response) => {
      // console.log(data.data.access_token);
      token = response.data.access_token;
      next();
  }).catch((err) => {
      console.log(err);
  })
}

app.post ("/lipa", generateToken, async(req, res) => {
  const phone = req.body.phone;
  const amount = req.body.amount;
  const shortcode=process.env.SHORT_CODE;
  const PASS_KEY=process.env.MPESA_PASS_KEY;

  const date = new Date();

  const timestamp = 
  date.getFullYear().toString() +
  ("0" + (date.getMonth() + 1)).slice(-2) +
  ("0" + date.getDate()).slice(-2) +
  ("0" + date.getHours()).slice(-2) +
  ("0" + date.getMinutes()).slice(-2) +
  ("0" + date.getSeconds()).slice(-2);

  const password = new Buffer.from(shortcode + PASS_KEY + timestamp).toString('base64');


  await axios.post (
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: amount,
          PartyA: phone, // Use the tenant's phone number here
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: 'https://mydomain.com/path',
          AccountReference: "0723245478",
          TransactionDesc: "test"
      },
      {
          headers: {
              Authorization: `Bearer ${token}`,
          },
      }
  ).then ((data) => {
      res.status(200).json(data.data);
  }).catch((err) => {
      console.log(err.message);
  })
})

// Endpoint to check transaction status
app.get('/transaction/status/:checkoutRequestID', generateToken, async (req, res) => {
  const checkoutRequestID = req.params.checkoutRequestID;

  try {
      const response = await axios.get(
          `https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query?checkoutRequestID=${checkoutRequestID}`,
          {
              headers: {
                  Authorization: `Bearer ${token}`,
              },
          }
      );
      const result = response.data;
      console.log('Transaction Status:', result);
      res.status(200).json(result);
  } catch (err) {
      console.error('Error querying transaction status:', err.message);
      res.status(500).send('Error querying transaction status');
  }
});

// Callback endpoint to handle M-Pesa callback
app.post('/callback', (req, res) => {
  try {
      const { Body } = req.body;
      const { stkCallback } = Body;
      const { ResultCode, ResultDesc, MpesaReceiptNumber, TransactionDate, PhoneNumber, Amount } = stkCallback;

      // Process the transaction data
      console.log("ResultCode:", ResultCode);
      console.log("ResultDesc:", ResultDesc);
      console.log("MpesaReceiptNumber:", MpesaReceiptNumber);
      console.log("TransactionDate:", TransactionDate);
      console.log("PhoneNumber:", PhoneNumber);
      console.log("Amount:", Amount);

      res.status(200).json({ message: "Callback received successfully" });
  } catch (error) {
      console.error("Error processing callback:", error);
      res.status(500).json({ message: "Error processing callback" });
  }
});
app.get('/lipa',(req,res)=>{
  res.sendFile(path.join(__dirname, '/templates/index.html'));
})


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
