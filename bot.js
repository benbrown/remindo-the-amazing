//  __   __  ___        ___
// |__) /  \  |  |__/ |  |  
// |__) \__/  |  |  \ |  |  

// This is the main file for the reminderbot bot.

// Import Botkit's core features
const { Botkit } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

const { InspectionMiddleware, InspectionState, BotFrameworkAdapter } = require('botbuilder')

// Import a platform-specific adapter for slack.
const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');

const { MongoDbStorage } = require('botbuilder-storage-mongodb');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
    storage = mongoStorage = new MongoDbStorage({
        url : process.env.MONGO_URI,
    });
}

const adapter = new SlackAdapter({
    // parameters used to secure webhook endpoint
    clientSigningSecret: process.env.clientSigningSecret,  

    // auth token for a single-team app
    botToken: process.env.botToken,
});

// Use SlackEventMiddleware to emit events that match their original Slack event types.
adapter.use(new SlackEventMiddleware());

// Use SlackMessageType middleware to further classify messages as direct_message, direct_mention, or mention
adapter.use(new SlackMessageTypeMiddleware());

const controller = new Botkit({
    debug: true,
    webhook_uri: '/api/messages',
    adapter: adapter,
    storage
});

// Bot Framework inspection middleware allows you to debug from the emulator
let inspectionState = new InspectionState(controller.storage);
let inspector = new InspectionMiddleware(inspectionState, undefined, controller.conversationState);
controller.adapter.use(inspector);

controller.ready(function() {
    // create an alternate adapter
    const sidecar = new BotFrameworkAdapter();
    // sidecar.use(inspector)
    controller.webserver.post('/api/sidecar', (req, res) => {
        sidecar.processActivity(req, res, async(turnContext) => {
            await inspector.processCommand(turnContext);
        });
    });
});

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {

    // load traditional developer-created local custom feature modules
    controller.loadModules(__dirname + '/features');

});