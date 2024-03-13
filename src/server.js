const express = require('express');
const { createServer } = require('http'); // Use http instead of https
const { readFileSync } = require('fs');
const { nanoid } = require('nanoid');
const { resolve } = require('path');
const WebSocket = require('ws');

const app = express();

const httpServer = createServer(app); // Create an HTTP server

app.use(express.static(resolve(__dirname, './../public')));

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (socket) => {
  console.log('new connection');

  socket.on('message', async (data) => {
    console.log('socket::message data=%s', data);

    try {
      const jsonMessage = JSON.parse(data);
      await handleJsonMessage(socket, jsonMessage);
    } catch (error) {
      console.error('failed to handle onmessage', error);
    }
  });

  socket.once('close', () => {
    console.log('socket::close');
  });
});

const handleJsonMessage = async (socket, jsonMessage) => {
  switch (jsonMessage.action) {
    case 'start':
      socket.id = nanoid();
      emitMessage(socket, { action: 'start', id: socket.id }); 
      break;
    default: 
      console.log('remote', jsonMessage.data.remoteId);
      if (!jsonMessage.data.remoteId) return;

      const remotePeerSocket = getSocketById(jsonMessage.data.remoteId);

      if (!remotePeerSocket) {
        return console.log('failed to find remote socket with id', jsonMessage.data.remoteId);
      }

      if (jsonMessage.action !== 'offer') {
        delete jsonMessage.data.remoteId;
      } else {
        jsonMessage.data.remoteId = socket.id;
      }

      await emitMessage(remotePeerSocket, jsonMessage); // Await the emission
  }
};

const emitMessage = (socket, jsonMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    return new Promise((resolve, reject) => {
      socket.send(JSON.stringify(jsonMessage), (error) => {
        if (error) {
          console.error('Error sending message:', error);
          reject(error); // Reject promise if there's an error
        } else {
          resolve(); // Resolve promise if message sent successfully
        }
      });
    });
  }
};

const getSocketById = (socketId) =>
  Array.from(wss.clients).find((client) => client.id === socketId);

httpServer.listen(80, () => {
  console.log('app server listening on port 8888');
});
