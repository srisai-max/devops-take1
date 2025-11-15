const exp = require('express')
const userapp = exp.Router();
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const verifyToken = require('../middleware/verifyToken')
const authmiddleware = require('../middleware/authmiddleware')
const expressAsyncHandler = require('express-async-handler')

let purchasehistory, userscollection;
userapp.use((req, res, next) => {
  userscollection = req.app.get('userscollection')
  purchasehistory = req.app.get('purchasehistory')
  next()
})
//triggering testingsss
//create a user
userapp.post('/user', expressAsyncHandler(async (req, res) => {
  let usercred = req.body;
  let existuser = await userscollection.findOne({ username: usercred.username })
  if (existuser !== null) {
    res.send({ message: "User already exists" })
  }
  else {
    const hashp = await bcryptjs.hash(usercred.password, 6)
    usercred.password = hashp
    await userscollection.insertOne(usercred)
    await purchasehistory.insertOne({ username: usercred.username, purchasehistory: [] })
    res.send({ message: "user successfully created" })
  }
  // res.send({message:"user credentials are",payload:usercred})
}))

//user login
userapp.post('/login', expressAsyncHandler(async (req, res) => {
  let usercred = req.body;
  let existuser = await userscollection.findOne({ username: usercred.username })
  if (existuser === null) {
    res.send({ message: "Invalid username" })
  }
  else {
    let result = await bcryptjs.compare(usercred.password, existuser.password)
    if (result) {
      const signedtoken = jwt.sign({ username: existuser.username }, process.env.SECRET_KEY, { expiresIn: '6h' })
      res.send({ message: "Login successful", token: signedtoken, user: existuser })
    }
    else {
      res.send({ message: "Invalid password" })
    }
  }
}))

//add purchase
userapp.post('/add-purchase', verifyToken, expressAsyncHandler(async (req, res) => {
  // console.log("purchase called")
  const purchase = req.body;
  // console.log(purchase.purchaseHistory.date)
  await autoUpdateBudgets(purchase.username);
  const date = new Date(purchase.purchaseHistory.date);
  // console.log(date)
  purchase.purchaseHistory.date = date;
  await purchasehistory.updateOne({ username: purchase.username }, { $push: { purchasehistory: purchase.purchaseHistory } })
  res.send({ message: "purchase inserted successfully", purchase: purchase })
}))

//delete purchase
userapp.delete('/delete-purchase/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  const username = req.params.username
  // console.log(req.body)
  const { purchase_name, price, category, date } = req.body;

  try {
    const result = await purchasehistory.updateOne(
      { username },
      {
        $pull: {
          purchasehistory: {
            purchase_name,
            price,
            category,
            date: new Date(date)
          }
        }
      }
    );
    res.send({ message: 'Purchase Deleted', result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Deletion failed' });
  }
}))

//set monthly budget
userapp.post('/set-monthly-budget/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  username = req.params.username
  mB = req.body;
  const startDate = new Date(mB.startDate)
  startDate.setUTCHours(0, 0, 0, 0)
  const inputDate = new Date(mB.startDate);
  // Add 1 month
  inputDate.setMonth(inputDate.getMonth() + 1);
  inputDate.setUTCHours(23, 59, 59, 999)
  await userscollection.updateOne({ username: username }, { $set: { 'monthlyBudget.budget': mB.budget, 'monthlyBudget.startDate': startDate, 'monthlyBudget.endDate': inputDate } })
  // console.log(res)
  res.send({ message: "Budget Updated", budget: mB, username: username })
}))

//set weekly budget
userapp.post('/set-weekly-budget/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  username = req.params.username
  mB = req.body;
  const startDate = new Date(mB.startDate)
  const inputDate = new Date(mB.startDate);
  startDate.setUTCHours(0, 0, 0, 0)
  // Add 1 week
  inputDate.setDate(inputDate.getDate() + 6);
  inputDate.setUTCHours(23, 59, 59, 999)
  await userscollection.updateOne({ username: username }, { $set: { 'weeklyBudget.budget': mB.budget, 'weeklyBudget.startDate': startDate, 'weeklyBudget.endDate': inputDate } })
  res.send({ message: "Budget Updated", budget: mB, username: username, endDate: inputDate })
}))

//set daily budget
userapp.post('/set-daily-budget/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  username = req.params.username
  mB = req.body;
  // console.log(mB)
  const startDate = new Date(mB.startDate)
  startDate.setUTCHours(0, 0, 0, 0)
  const inputDate = new Date(mB.startDate);
  //End Time
  inputDate.setHours(23, 59, 59, 999);
  inputDate.setUTCHours(23, 59, 59, 999);
  await userscollection.updateOne({ username: username }, { $set: { 'dailyBudget.budget': mB.budget, 'dailyBudget.startDate': startDate, 'dailyBudget.endDate': inputDate } })
  res.send({ message: "Budget Updated", budget: mB, username: username, endDate: inputDate })
}))

userapp.patch('/set-daily-budget/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  const username = req.params.username;
  const mB = req.body || {};

  const updateObj = {};
  if (mB.budget !== undefined) updateObj['dailyBudget.budget'] = mB.budget;
  if (mB.startDate !== undefined) {
    const startDate = new Date(mB.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    updateObj['dailyBudget.startDate'] = startDate;
  }
  if (mB.endDate !== undefined) {
    const endDate = new Date(mB.endDate);
    endDate.setUTCHours(23, 59, 59, 999);
    updateObj['dailyBudget.endDate'] = endDate;
  }

  if (Object.keys(updateObj).length === 0) {
    return res.status(400).send({ message: 'No fields provided to update' });
  }

  await userscollection.updateOne({ username }, { $set: updateObj });
  res.send({ message: 'Daily budget patched', updated: updateObj });
}));





userapp.put('/set-weekly-budget/:username', verifyToken, expressAsyncHandler(async (req, res) => {
  const username = req.params.username;
  const mB = req.body;
  const startDate = new Date(mB.startDate);
  startDate.setUTCHours(0, 0, 0, 0);
  const inputDate = new Date(mB.startDate);
  inputDate.setDate(inputDate.getDate() + 6);
  inputDate.setUTCHours(23, 59, 59, 999);
  await userscollection.updateOne(
    { username },
    {
      $set: {
        'weeklyBudget.budget': mB.budget,
        'weeklyBudget.startDate': startDate,
        'weeklyBudget.endDate': inputDate
      }
    }
  );
  res.send({ message: "Budget Updated", budget: mB, username, endDate: inputDate });
}));
//view monthly budget
userapp.get('/view-monthly-budget/:username', verifyToken, (expressAsyncHandler(async (req, res) => {
  const username = req.params.username
  const user = await userscollection.findOne({ username: username })
  const startDate = user.monthlyBudget.startDate;
  const endDate = user.monthlyBudget.endDate;


  const record = await purchasehistory.findOne({ username });
  if (!record || !record.purchasehistory) {
    return res.send({ message: "No purchases found", payload: [] });
  }

  if (record && record.purchasehistory) {
    record.purchasehistory.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending
  }

  const result = record.purchasehistory.filter(p => {
    const date = new Date(p.date);
    return date >= new Date(startDate) && date <= new Date(endDate);
  });


  const totalSpent = result.reduce((sum, purchase) => sum + purchase.price, 0);

  res.send({ message: "user details are", user: user, payload: result, totalSpent })
})))

//view weekly budget
userapp.get('/view-weekly-budget/:username', verifyToken, (expressAsyncHandler(async (req, res) => {
  const username = req.params.username
  const user = await userscollection.findOne({ username: username })
  const startDate = user.weeklyBudget.startDate;
  const endDate = user.weeklyBudget.endDate

  const record = await purchasehistory.findOne({ username });
  if (!record || !record.purchasehistory) {
    return res.send({ message: "No purchases found", payload: [] });
  }

  if (record && record.purchasehistory) {
    record.purchasehistory.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending
  }

  const result = record.purchasehistory.filter(p => {
    const date = new Date(p.date);
    return date >= new Date(startDate) && date <= new Date(endDate);
  });

  const totalSpent = result.reduce((sum, purchase) => sum + purchase.price, 0);

  res.send({ message: "user details are", user: user, payload: result, totalSpent })
})))


userapp.get('/view-daily-budget/:username', verifyToken, (expressAsyncHandler(async (req, res) => {
  const username = req.params.username
  const user = await userscollection.findOne({ username: username })
  const startDate = user.dailyBudget.startDate;
  const endDate = user.dailyBudget.endDate

  const record = await purchasehistory.findOne({ username });
  if (!record || !record.purchasehistory) {
    return res.send({ message: "No purchases found", payload: [] });
  }

  if (record && record.purchasehistory) {
    record.purchasehistory.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending
  }

  const result = record.purchasehistory.filter(p => {
    const date = new Date(p.date);
    return date >= new Date(startDate) && date <= new Date(endDate);
  });

  const totalSpent = result.reduce((sum, purchase) => sum + purchase.price, 0);

  res.send({ message: "user details are", user: user, payload: result, totalSpent })
})))

//view custom budget
userapp.get('/view-custom-budget/:username', verifyToken, (expressAsyncHandler(async (req, res) => {
  const username = req.params.username
  const user = await userscollection.findOne({ username: username })
  const startDate = user.customBudget.startDate;
  const endDate = user.customBudget.endDate;
  // console.log(user)
  const record = await purchasehistory.findOne({ username });
  if (!record || !record.purchasehistory) {
    return res.send({ message: "No purchases found", payload: [] });
  }

  if (record && record.purchasehistory) {
    record.purchasehistory.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending
  }

  const result = record.purchasehistory.filter(p => {
    const date = new Date(p.date);
    return date >= new Date(startDate) && date <= new Date(endDate);
  });


  const totalSpent = result.reduce((sum, purchase) => sum + purchase.price, 0);

  res.send({ message: "user details are", user: user, payload: result, totalSpent })
})))


userapp.get('/reload', authmiddleware, (expressAsyncHandler(async (req, res) => {
  const user = req.user
  const existuser = await userscollection.findOne({ username: user.username })
  res.send({ message: "user sent", user: existuser })
})))










const autoUpdateBudgets = async (username) => {
  const user = await userscollection.findOne({ username });
  const now = new Date();
  const updates = {};

  if (user.dailyBudget?.endDate && new Date(user.dailyBudget.endDate) < now) {
    const newStart = new Date(); newStart.setUTCHours(0, 0, 0, 0);
    const newEnd = new Date(); newEnd.setUTCHours(23, 59, 59, 999);
    updates["dailyBudget.startDate"] = newStart;
    updates["dailyBudget.endDate"] = newEnd;
  }

  if (user.weeklyBudget?.endDate && new Date(user.weeklyBudget.endDate) < now) {
    const newStart = new Date(); newStart.setUTCHours(0, 0, 0, 0);
    const newEnd = new Date(newStart); newEnd.setDate(newEnd.getDate() + 7);
    newEnd.setUTCHours(23, 59, 59, 999);
    updates["weeklyBudget.startDate"] = newStart;
    updates["weeklyBudget.endDate"] = newEnd;
  }

  if (user.monthlyBudget?.endDate && new Date(user.monthlyBudget.endDate) < now) {
    const newStart = new Date(); newStart.setUTCHours(0, 0, 0, 0);
    const newEnd = new Date(newStart); newEnd.setMonth(newEnd.getMonth() + 1);
    newEnd.setUTCHours(23, 59, 59, 999);
    updates["monthlyBudget.startDate"] = newStart;
    updates["monthlyBudget.endDate"] = newEnd;
  }

  if (Object.keys(updates).length > 0) {
    await userscollection.updateOne({ username }, { $set: updates });
  }
};












module.exports = userapp;
