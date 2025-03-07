import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);
app.use(express.static(path.join(__dirname, 'out')));

import { Server } from "socket.io";
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ["GET", "POST"],
  }
});

app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['https://cofun.digital']);
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append('Access-Control-Allow-Headers', 'Content-Type');
  res.append('X-Frame-Options', 'https://cofun.digital');
  next();
});


app.get('/health', (req, res) => {
  res.send({ message: 'Welcome to socket-io!' });
});

io.on('connection', (socket) => {
  const getOffers = async (country) => {
    try {
      const response = await fetch(`https://winter-limit-2863.ploomber.app//api/scrape-jobs?country=${country}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data.jobs)) {
        throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
      }

      return data.jobs;
    } catch (e) {
      console.error("Error fetching offers:", e);
      return [];
    }
  };

  socket.on('init', (callback) => {
    callback({
      activeKey: "init",
      questions: [
        "Hey, we would like to support you with next steps in your career goals and offer you assistance with a personalized search.",
        "Would you have time to answer a few questions?"
      ],
      suggestions: [{ answer: `Let's do it`, key: true }, { answer: `Not now`, key: false }],
    });
  });

  socket.on('update_item', async (arg1, arg2, callback) => {
    if (arg1 === "init") {
      const consent = arg2 === true || arg2 === "Let's do it" || !!arg2 && arg2.toLowerCase().includes('yes');
      if (consent) {
        return callback({
          activeKey: "title",
          id: "title",
          questions: ["What is your primary place of residence?"],
          title: 'Country of residence',
          description: "We are using web crawling methods to retrieve data from public job search platforms. Offers may be limited to a few countries at the moment.",
          type: "button_select",
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' },
          answers: [
            { answer: `Austria`, key: 'austria' },
            { answer: `Belgium`, key: 'belgium' },
            { answer: `Czech Republic`, key: 'czech republic' },
            { answer: `France`, key: 'france' },
            { answer: `Germany`, key: 'germany' },
            { answer: `Japan`, key: 'japan' },
            { answer: `Netherlands`, key: 'netherlands' },
            { answer: `Switzerland`, key: 'switzerland' },
            { answer: `United Kingdom`, key: 'united kingdom' },
            { answer: `Other`, key: 'other' }
          ],
        });
      } else {
        return callback({
          activeKey: "listening_closed",
          questions: ["Thank you for your feedback!"]
        });
      }
    }

    if (arg1 === "title") {
      if (arg2 === "other") {
        return callback({
          type: "open",
          id: "close",
          questions: ["Sorry, the job offers are limited to certain regions. Please search again later."]
        });
      }
      const encoded = encodeURIComponent(arg2);
      const offers = await getOffers(encoded);

      if (!offers.length) {
        return callback({
          type: "open",
          id: "close",
          questions: ["Sorry, we haven't found any new jobs in your area. Please search again later."]
        });
      }

      return callback({
        activeKey: "keyword",
        id: "offers",
        questions: [`We found ${offers.length} new jobs in your area.`, "What is the job title or role that you're looking for?"],
        payload: offers
      });
    }
    if (arg1 === "keyword") {
      return callback({
        questions: ["We will connect you to our AI agent and personalize your search."],
        activeKey: "profession",
      });
    }
  });
});

io.engine.on("connection_error", (err) => {
  console.error("Socket.io connection error:", err);
});

const port = process.env.PORT || 3333;
server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
server.on('error', console.error);
