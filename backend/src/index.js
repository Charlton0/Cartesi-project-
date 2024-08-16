const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = 3000;

app.use(bodyParser.json());

class ExpenseTracker {
  constructor() {
    this.expenses = [];
  }

  addExpense(expense) {
    this.expenses.push(expense);
  }

  getExpenses() {
    return this.expenses;
  }

  getTotalExpenses() {
    return this.expenses.reduce((total, expense) => total + expense.amount, 0);
  }
}

const tracker = new ExpenseTracker();

app.post("/expense", (req, res) => {
  const { date, amount, description } = req.body;

  if (!date || !amount || !description) {
    return res.status(400).send({ error: "Invalid input" });
  }

  const expense = {
    id: uuidv4(),
    date: new Date(date),
    amount,
    description,
  };

  // Add the expense to the tracker
  tracker.addExpense(expense);

  // Send the expense to Cartesi Machine (Assuming Cartesi is running on localhost:5000)
  axios
    .post("http://localhost:5000/api/expense", expense)
    .then(() => res.status(201).send(expense))
    .catch((err) =>
      res
        .status(500)
        .send({ error: "Failed to save expense to Cartesi Machine" })
    );
});

app.get("/expenses", (req, res) => {
  res.send(tracker.getExpenses());
});

app.get("/total", (req, res) => {
  res.send({ total: tracker.getTotalExpenses() });
});

app.listen(port, () => {
  console.log(`Expense tracker app listening at http://localhost:${port}`);
});
