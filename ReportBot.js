require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Use environment variables for sensitive information
const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Twilio Account SID from the environment variable
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Twilio Auth Token from the environment variable
const client = twilio(accountSid, authToken);

const twilioNumber = process.env.TWILIO_NUMBER; // Your Twilio WhatsApp number

// In-memory storage for user state
const userStates = {};
const messageTimestamps = {}; // Store timestamps for messages

app.post('/whatsapp', (req, res) => {
  const incomingMessage = req.body.Body;
  const from = req.body.From;

  // Initialize user state if not present
  if (!userStates[from]) {
    userStates[from] = {
      step: 'start', // Current step in the form process
      data: {}
    };
  }

  // Initialize message timestamp if not present
  if (!messageTimestamps[from]) {
    messageTimestamps[from] = {};
  }

  let responseMessage = '';

  // Retrieve the user's current state
  const userState = userStates[from];
  const now = new Date();
  
  // Format date and time
  const currentDate = now.toLocaleDateString('en-GB').replace(/\//g, '/'); // Format: DD/MM/YY
  const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format: HH:mm

  switch (userState.step) {
    case 'start':
      if (incomingMessage === 'תקלה') {
        messageTimestamps[from].date = currentDate;
        messageTimestamps[from].time = currentTime;
        userStates[from].step = 'issue_type';
        responseMessage = 'סוג תקלה?';
      } else {
        responseMessage = 'Send "תקלה" to start the issue reporting.';
      }
      break;

    case 'issue_type':
      userStates[from].data['סוג תקלה'] = incomingMessage;
      userStates[from].step = 'site_name';
      responseMessage = 'שם אתר?';
      break;

    case 'site_name':
      userStates[from].data['שם אתר'] = incomingMessage;
      userStates[from].step = 'part_type';
      responseMessage = 'סוג אמצעי?';
      break;      

    case 'part_type':
      userStates[from].data['סוג אמצעי'] = incomingMessage;
      userStates[from].step = 'issue_nature';
      responseMessage = 'מהות התקלה?';
      break;

    case 'issue_nature':
      userStates[from].data['מהות התקלה'] = incomingMessage;
      userStates[from].step = 'end_time';
      responseMessage = 'שעת סיום?';
      break;

    case 'end_time':
      userStates[from].data['שעת סיום'] = incomingMessage;
      userStates[from].step = 'solution';
      responseMessage = 'פתרון?';
      break;

    case 'solution':
      userStates[from].data['פתרון'] = incomingMessage;
      userStates[from].step = 'replaced_equipment';
      responseMessage = 'אמצעי שהוחלף?';
      break;

    case 'replaced_equipment':
      userStates[from].data['אמצעי שהוחלף'] = incomingMessage;
      userStates[from].step = 'technician_name';
      responseMessage = 'שם הטכנאי?'; // New question
      break;

    case 'technician_name':
      userStates[from].data['שם הטכנאי'] = incomingMessage;

      // Format response message
      responseMessage = `
תאריך התחלה: ${messageTimestamps[from].date}
סוג תקלה: ${userStates[from].data['סוג תקלה'] || ''}
שם אתר: ${userStates[from].data['שם אתר'] || ''}
סוג אמצעי: ${userStates[from].data['סוג אמצעי'] || ''}
שעת התחלה: ${messageTimestamps[from].time}
שעת סיום: ${userStates[from].data['שעת סיום'] || ''}
מהות התקלה: ${userStates[from].data['מהות התקלה'] || ''}
פתרון: ${userStates[from].data['פתרון'] || ''}
אמצעי שהוחלף: ${userStates[from].data['אמצעי שהוחלף'] || ''}
שם הטכנאי: ${userStates[from].data['שם הטכנאי'] || ''}
      `;
      
      // Clear user state and timestamp
      delete userStates[from];
      delete messageTimestamps[from];
      break;

    default:
      responseMessage = 'Something went wrong. Please start over by sending "תקלה".';
  }

  client.messages
    .create({
      body: responseMessage,
      from: twilioNumber,
      to: from,
    })
    .then(message => console.log('Message sent:', message.sid))
    .catch(err => console.error(err));

  res.send('<Response></Response>');
});

const port = process.env.PORT || 3000; // Use PORT from environment variables or default to 3000
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
