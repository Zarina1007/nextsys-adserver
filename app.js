const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser')
require('dotenv').config();
var searchRouter = require('./routes/search');

const app = express();
app.use(express.static('public'));
// CORS is enabled for all origins
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser())

//routes
app.use('/', searchRouter);

const port = process.env.PORT || 9100;
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
});