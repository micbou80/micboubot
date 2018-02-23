/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add 
natural language support to a bot. 
For a complete walkthrough of creating this type of bot see the article at
https://aka.ms/abs-node-luis
-----------------------------------------------------------------------------*/
"use strict";

const builder = require("botbuilder");
const botbuilder_azure = require("botbuilder-azure");
const builder_cognitiveservices = require("botbuilder-cognitiveservices")
const path = require('path');

// Configure Application Insights
if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    const AppInsights = require('applicationinsights');
    AppInsights.setup().start();
}

// Check if production or emulator
const is_development = (process.env.NODE_ENV == 'development');

// Configure ChatConnector
const connector = is_development ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

const bot = new builder.UniversalBot(connector);

bot.set('localizerSettings', {
    botLocalePath: __dirname + "\locale",
    defaultLocale: 'nl'
});

// bot.localePath(path.join(__dirname, './locale'));
/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */
if (!is_development) {
    const tableName = 'botdata';
    const azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
    const tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

    bot.set('storage', tableStorage);
}

if (is_development) {
    const restify = require('restify');
    const server = restify.createServer();

    // Setup endpoint for incoming messages which will be passed to the bot's ChatConnector.
    server.post('/api/messages', connector.listen());

    // Start server
    server.listen(process.env.PORT || 3978, () => {
        console.log(`Bot Framework listening to ${server.url}`);
    });

    server.post('/api/messages', connector.listen());
} else {
    module.exports = connector.listen();
}

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));
bot.use(builder.Middleware.sendTyping());

//=========================================================
// Bots Recognizers
//=========================================================

// LUIS Recognizer
const luisAppId = process.env.LuisAppId;
const luisAPIKey = process.env.LuisAPIKey;
const bingSpellCheckKey = process.env.BingSpellCheckKey;
const luisAPIHostName = process.env.LuisAPIHostName || 'westeurope.api.cognitive.microsoft.com';
const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey;

const luis_recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(luis_recognizer);

// QnAMakerRecognizer
const qna_recognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    subscriptionKey: process.env.QnASubscriptionKey
});

bot.recognizer(qna_recognizer);

//=========================================================
// Bots Dialogs
//=========================================================

// Start default dialog on first open
bot.on('conversationUpdate', (message) => {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {

                // Bot is joining conversation (page loaded)
                bot.send(
                    new builder.Message()
                        .address(message.address)
                        .text('Hey! Welkom op mijn website. Zin om te praten?')
                );

                bot.send(
                    new builder.Message()
                        .address(message.address)
                        .text('Mijn naam is Michel Bouman, ik ben 37, heb 4 kids en werk voor Microsoft Nederland. Ik praat graag over digitale transformatie en nieuwe technologien als artificial intelligence, maar ben ook bezig met hoe ik nog slimmer de dag door kom.')
                        .suggestedActions(
                            builder.SuggestedActions.create(
                                null, [
                                    builder.CardAction.postBack(null, 'experience', 'Michel, wat voor werk ervaring heb je?'),
                                    builder.CardAction.postBack(null, 'work-smarter', 'Even terug. Je zei iets over slimmer werken. Tell me more!'),
                                    builder.CardAction.postBack(null, 'contact', 'Ik wil graag met je in contact komen.')
                                ]
                            ))
                );

            }
        });
    }
});

// Default Dialog
bot.dialog('/', function (session) {
    session.send('Default Dialog')
    session.endDialog();
}).triggerAction({
    matches: ['Default']
});

// Unknown Dialog
bot.dialog('/unknown', function (session) {

    var msg = new builder.Message(session)
        .text('Oei, ik denk dat ik je nog niet helemaal begrijp...')
        .suggestedActions(
            builder.SuggestedActions.create(
                session, [
                    builder.CardAction.postBack(session, 'experience', 'Michel, wat voor werk ervaring heb je?'),
                    builder.CardAction.postBack(session, 'work-smarter', 'Even terug. Je zei iets over slimmer werken. Tell me more!'),
                    builder.CardAction.postBack(session, 'contact', 'Ik wil graag met je in contact komen.')
                ]
            ));

}).triggerAction({
    matches: ['unknown']
});

// QnA Maker Dialog
bot.dialog('/qna', function (session, args, next) {
    const answerEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'answer');
    session.endDialog(answerEntity.entity);
}).triggerAction({
    matches: ['qna']
});

// Greeting Dialog (LUIS)
bot.dialog('/greeting', function (session) {
    session.endDialog('Hi');
}).triggerAction({ matches: ['Greeting'] });

// Contact Dialog (LUIS)
bot.dialog('/contact', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'Je kunt me via twitter bereiken op http://www.twitter.com/boumanmichel of wil je me liever e-mailen?');
    },
    (session, args, next) => {
        if (args.response == false) {
            session.endDialog('Okidoki. Ik zie je tweet wel verschijnen. Als ik iets voor je kan doen, dan weet je me te vinden.');
            return;
        }
        builder.Prompts.text(session, 'Wat is je e-mail adres?')
    },

    (session, args, next) => {
        if (args.response) {
            session.dialogData.email = args.response;
            builder.Prompts.text(session, 'Got it. Je kunt het bericht typen en ik zorg er dan voor, dat de e-mail verstuurd wordt.');
        }
    },
    (session, args, next) => {
        if (args.response) {
            session.dialogData.text = args.response;

            const nodemailer = require('nodemailer');
            const smtpTransport = require('nodemailer-smtp-transport');

            let transporter = nodemailer.createTransport(smtpTransport({
                host: process.env.MailHost,
                port: 587,
                secure: false, // use TLS
                auth: {
                    user: process.env.MailUser,
                    pass: process.env.MailPassword
                },
                tls: {
                    rejectUnauthorized: false
                }
            }));

            transporter.verify(function (error, success) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Server is ready to take our messages');
                }
            });

            const mailOptions = {
                from: session.dialogData.email, // sender address
                to: 'bot@michelbouman.nl', // list of receivers
                subject: 'Mail vanaf de bot', // Subject line
                text: session.dialogData.text
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    session.error(error);
                } else {
                    session.send('Je bericht is verzonden, je hoort snel van me!');
                };
            });

        }

    }
]).triggerAction({ matches: 'Contact' });

// Help Dialog
bot.dialog('/help', function (session) {
    session.endDialog("Help");
}).triggerAction({ matches: 'Help' });
