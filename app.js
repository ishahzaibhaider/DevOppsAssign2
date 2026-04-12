const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/student_records';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Student Schema
const studentSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  course:     { type: String, required: true },
  marks:      { type: Number, required: true, min: 0, max: 100 },
  createdAt:  { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// ── Routes ───────────────────────────────────────────────────────────────────

// GET / — list all students
app.get('/', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.render('index', { students, message: req.query.message || null });
  } catch (err) {
    res.status(500).send('Error fetching records');
  }
});

// GET /add — show add form
app.get('/add', (req, res) => {
  res.render('add', { error: null });
});

// POST /add — create new student
app.post('/add', async (req, res) => {
  const { name, rollNumber, course, marks } = req.body;
  try {
    await Student.create({ name, rollNumber, course, marks: Number(marks) });
    res.redirect('/?message=Student+added+successfully');
  } catch (err) {
    const error = err.code === 11000
      ? 'Roll number already exists'
      : 'Failed to add student. Check all fields.';
    res.render('add', { error });
  }
});

// DELETE /:id — delete a student
app.delete('/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect('/?message=Student+deleted');
  } catch (err) {
    res.redirect('/');
  }
});

// Health check endpoint (useful for Docker/K8s)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
