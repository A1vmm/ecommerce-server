const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const serverless = require("serverless-http");
dotenv.config({ path: ".env" });

const app = express();
const port = process.env.PORT || 4000;
const MONGODB_URL = process.env.MONGODB_URL;

// Middlewares
app.use(express.json());
app.use(cors());
app.use('/images', express.static('upload/images'));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Image upload endpoint
app.post("/upload", upload.single('product'), (req, res) => {
  res.json({
    success: 1,
    image_url: `/images/${req.file.filename}`,
  });
});

// JWT Auth Middleware
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errors: "Please authenticate using a valid token" });

  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
};

// Mongoose Models
const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  date: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: String,
  description: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
  date: { type: Date, default: Date.now },
  avilable: { type: Boolean, default: true },
});

// Root Route
app.get("/", (req, res) => {
  res.send("API Root");
});

// Auth Routes
app.post('/login', async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (!user || user.password !== req.body.password) {
    return res.status(400).json({ success: false, errors: "Invalid credentials" });
  }
  const token = jwt.sign({ user: { id: user.id } }, 'secret_ecom');
  res.json({ success: true, token });
});

app.post('/signup', async (req, res) => {
  const existing = await Users.findOne({ email: req.body.email });
  if (existing) return res.status(400).json({ success: false, errors: "Email already in use" });

  const cart = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [i, 0]));

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();

  const token = jwt.sign({ user: { id: user.id } }, 'secret_ecom');
  res.json({ success: true, token });
});

// Product Routes
app.get("/allproducts", async (_, res) => {
  const products = await Product.find();
  res.send(products);
});

app.get("/newcollections", async (_, res) => {
  const products = await Product.find();
  res.send(products.slice(-8));
});

app.get("/popularinwomen", async (_, res) => {
  const products = await Product.find({ category: "women" });
  res.send(products.slice(0, 4));
});

app.post("/relatedproducts", async (req, res) => {
  const { category } = req.body;
  const products = await Product.find({ category });
  res.send(products.slice(0, 4));
});

app.post("/addproduct", async (req, res) => {
  const products = await Product.find();
  const id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

  const product = new Product({ id, ...req.body });
  await product.save();

  res.json({ success: true, name: req.body.name });
});

app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({ success: true });
});

// Cart Routes
app.post('/addtocart', fetchuser, async (req, res) => {
  const user = await Users.findById(req.user.id);
  user.cartData[req.body.itemId] += 1;
  await user.save();
  res.send("Added");
});

app.post('/removefromcart', fetchuser, async (req, res) => {
  const user = await Users.findById(req.user.id);
  if (user.cartData[req.body.itemId] > 0) {
    user.cartData[req.body.itemId] -= 1;
  }
  await user.save();
  res.send("Removed");
});

app.post('/getcart', fetchuser, async (req, res) => {
  const user = await Users.findById(req.user.id);
  res.json(user.cartData);
});

// Connect to MongoDB and start server
// const startServer = async () => {
//   try {
//     await mongoose.connect(MONGODB_URL);
//     console.log("✅ MongoDB Connected");
//     app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
//   } catch (err) {
//     console.error("❌ MongoDB connection failed:", err.message);
//     process.exit(1);
//   }
// };

// startServer();



mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err.message));

module.exports = serverless(app);
