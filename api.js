const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let usersCollection;

async function runMongo() {
  try {
    await client.connect();
    const db = client.db('productivitypro');
    usersCollection = db.collection('users');
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}
runMongo();

// Helper to ensure MongoDB is connected before each request
async function ensureMongoConnected() {
  if (!client.topology || !client.topology.isConnected()) {
    try {
      await client.connect();
      console.log('Reconnected to MongoDB');
    } catch (err) {
      console.error('MongoDB reconnection error:', err);
    }
  }
}

// Create or update user on login/register (email/password or Google)
app.post('/api/users', async (req, res) => {
  await ensureMongoConnected();
  const { uid, email, displayName, photoURL, provider } = req.body;
  if (!uid || !email) return res.status(400).json({ error: 'uid and email required' });
  try {
    const existing = await usersCollection.findOne({ uid });
    if (existing) {
      // Only update profile info and lastLogin, do not create new document
      const result = await usersCollection.updateOne(
        { uid },
        { $set: { email, displayName, photoURL, provider, lastLogin: new Date() } }
      );
      return res.json({ success: true, updated: true, result });
    } else {
      // Create new user document
      const doc = {
        uid,
        email,
        displayName,
        photoURL,
        provider,
  lastLogin: new Date(),
  tasks: [],
  habits: [],
  goals: [],
  notes: [],
  mindMap: [],
  journal: [],
  planner: [],
  collaboration: [], // { email, name, avatar, sharedTasks: [] }
  namaz: [], // Namaz Tracker records
  settings: { visibleSections: ["Dashboard","Tasks","Notes","Habits","Goals","Planner","Journal","Calendar","Collaboration","MindMap","Music","Resources","Review","Pomodoro","NamazTracker"] },
  createdAt: new Date()
};

// Namaz Tracker: Save namaz records
app.put('/api/users/:uid/namaz', async (req, res) => {
  await ensureMongoConnected();
  try {
    const { namaz } = req.body;
    if (!Array.isArray(namaz)) return res.status(400).json({ error: 'namaz must be array' });
    const result = await usersCollection.updateOne(
      { uid: req.params.uid },
      { $set: { namaz } }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings: Save user settings
app.put('/api/users/:uid/settings', async (req, res) => {
  await ensureMongoConnected();
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings must be object' });
    const result = await usersCollection.updateOne(
      { uid: req.params.uid },
      { $set: { settings } }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Invite a collaborator by email (adds to both users' collaboration arrays)
app.post('/api/collaboration/invite', async (req, res) => {
  await ensureMongoConnected();
  const { inviterUid, inviteeEmail, inviteeName, inviteeAvatar } = req.body;
  if (!inviterUid || !inviteeEmail) return res.status(400).json({ error: 'inviterUid and inviteeEmail required' });
  try {
    console.log('Invite endpoint: searching for inviteeEmail:', inviteeEmail);
    const inviter = await usersCollection.findOne({ uid: inviterUid });
    // Case-insensitive, trimmed, and lowercased email search
    const normalizedEmail = inviteeEmail.trim().toLowerCase();
    const invitee = await usersCollection.findOne({
      $expr: {
        $eq: [
          { $toLower: "$email" },
          normalizedEmail
        ]
      }
    });
    console.log('Invite endpoint: found invitee:', invitee);
    if (!inviter) return res.status(404).json({ error: 'Inviter not found' });
    if (!invitee) return res.status(404).json({ error: 'Invitee not found' });
    // Add invitee to inviter's collaboration
    await usersCollection.updateOne(
      { uid: inviterUid },
      { $addToSet: { collaboration: { email: invitee.email, name: invitee.displayName || inviteeName, avatar: invitee.photoURL || inviteeAvatar, sharedTasks: [] } } }
    );
    // Add inviter to invitee's collaboration
    await usersCollection.updateOne(
      { uid: invitee.uid },
      { $addToSet: { collaboration: { email: inviter.email, name: inviter.displayName, avatar: inviter.photoURL, sharedTasks: [] } } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a collaborator by email
app.post('/api/collaboration/remove', async (req, res) => {
  await ensureMongoConnected();
  const { userUid, collaboratorEmail } = req.body;
  if (!userUid || !collaboratorEmail) return res.status(400).json({ error: 'userUid and collaboratorEmail required' });
  try {
    await usersCollection.updateOne(
      { uid: userUid },
      { $pull: { collaboration: { email: collaboratorEmail } } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update shared tasks with a collaborator
app.post('/api/collaboration/update-tasks', async (req, res) => {
  await ensureMongoConnected();
  const { userUid, collaboratorEmail, sharedTasks } = req.body;
  if (!userUid || !collaboratorEmail || !Array.isArray(sharedTasks)) return res.status(400).json({ error: 'userUid, collaboratorEmail, sharedTasks required' });
  try {
    await usersCollection.updateOne(
      { uid: userUid, 'collaboration.email': collaboratorEmail },
      { $set: { 'collaboration.$.sharedTasks': sharedTasks } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
      const result = await usersCollection.insertOne(doc);
      return res.json({ success: true, created: true, result });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user data
app.get('/api/users/:uid', async (req, res) => {
  await ensureMongoConnected();
  try {
    const user = await usersCollection.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user data (tasks, habits, etc.)
app.put('/api/users/:uid', async (req, res) => {
  await ensureMongoConnected();
  try {
    const update = req.body;
    const result = await usersCollection.updateOne(
      { uid: req.params.uid },
      { $set: update }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Express server is running!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
