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
} else {
    // Set up temporary storage
    const inMemoryStorage = new builder.MemoryBotStorage();
    bot.set('storage', inMemoryStorage)
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
bot.use(builder.Middleware.firstRun({ version: 1.0, dialogId: '*:/name' }));

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
                        .text('Hey! Welcome on my website. Wanna talk?')
                );

                const welcomeMessage = new builder.Message()
                    .address(message.address)
                    .text('My name is Michel. I am a proud husband, father and Microsoft employee. I am very much into digital transformation of company and tech like artificial intelligence. Since I decided to go back to school last year, my life is quite full. Therefore, I am also very much into productivity hack. Ask me something or select one of the buttons below.')
                    .suggestedActions(
                        builder.SuggestedActions.create(
                            null, [
                                builder.CardAction.postBack(null, 'experience', 'Work'),
                                builder.CardAction.postBack(null, 'work-smarter', 'Productivity'),
                                builder.CardAction.postBack(null, 'contact', 'Get in touch')
                            ]
                        ));

                setTimeout(function () {
                    bot.send(welcomeMessage);
                }, 1000);
            }
        });
    }
});

bot.dialog('/name', [
    (session, args, next) => {
        builder.Prompts.text(session, "First things first. My name is Michel Bot. What's your name?");
    },
    (session, args, next) => {
        if (args.response) {
            session.userData.name = args.response;
            session.endDialog('Thanks, love it! Welcome to the site %s. Lets chat!', session.userData.name);
        } else {
            next();
        }
    }
]);

// Default Dialog
bot.dialog('/', [
    (session, args, next) => {
        if (session.userData.name !== undefined) {
            session.send('Hey %s! I am excited to see you back here', session.userData.name);
            next();
        }
        next();
    },
    (session, args, next) => {
        if (args.response !== undefined) {
            session.userData.name = args.response;
            session.send('Thanks, love it! Welcome to the site %s. Lets chat', session.userData.name);
        }

        builder.Prompts.choice(session, 'What would you like to talk about?', [
            'Tell me about your work experience',
            'Why did you go back to school?',
            'I wish I had more time. How do you manage?',
            'I want to get in touch with you'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });
    },
    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {
                case 0:
                    session.beginDialog('/experience');
                    break;
                case 1:
                    session.beginDialog('/school');
                    break;
                case 2:
                    session.beginDialog('/work-smarter');
                    break;
                case 3:
                    session.beginDialog('/contact');
                    break;
                default:
                    session.endDialog('Looks like that wasnt an option to select. Try again.');
            }
        }
    }
]).triggerAction({
    matches: ['Greeting']
});

// Joke Dialog (LUIS)
bot.dialog('/joke', (session) => {
    session.endDialog('Sorry, Michel didnt give me a sense of humor (yet)');
}).triggerAction({
    matches: ['Joke']
});

// Unknown Dialog
bot.dialog('/unknown', (session) => {

    var msg = new builder.Message(session)
        .text('Uh oh, I think my artificial brain needs some tweaking, because I am not sure what to do now.')
        .suggestedActions(
            builder.SuggestedActions.create(
                session, [
                    builder.CardAction.postBack(session, 'experience', 'So, tell me about your work experience'),
                    builder.CardAction.postBack(session, 'work-smarter', 'Do you have any productivity tips?'),
                    builder.CardAction.postBack(session, 'contact', 'How do I get in touch with you?.')
                ]
            ));

}).triggerAction({
    matches: ['unknown']
});

// QnA Maker Dialog
bot.dialog('/qna', (session, args, next) => {
    const answerEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'answer');
    session.endDialog(answerEntity.entity);
}).triggerAction({
    matches: ['qna']
});

// Help Dialog
bot.dialog('/help', (session) => {
    session.endDialog('Help Dialog');
}).triggerAction({ matches: 'Help' });

bot.dialog('/ebook', [
    (session, args, next) => {

        builder.Prompts.choice(session, 'Wacht even...hoe weet je dat? Het e-book over Digitale Transformation in het MKB moet ergens in Q1 van 2018 uitkomen.', [
            'Hou me op de hoogte!',
            'Ok, dan kom ik later nog wel een keer terug.'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });

    },
    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {

                case 0:
                    session.beginDialog('/contact');
                    break;
                case 1:
                    session.beginDialog('/later');
                    break;
                default:
                    session.endDialog('Uh oh, seems like you picked a non-excisting option. Try again');
            }
        }

    }
]);

bot.dialog('/experience', [
    (session, args, next) => {

        builder.Prompts.choice(session, 'I have been working for the Dutch subsidiary of Microsoft since 2012. Before my role at Microsoft I have had sales management roles at Misco Nederland (part of Systemax Ltd.), European Directories and T-Mobile Business. In short; 18 years of work experience of which 12 in management.', [
            'What do you do at Microsoft?',
            'I would like to get in touch with you.'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });

    },
    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {

                case 0:
                    session.beginDialog('/msft');
                    break;
                case 1:
                    session.beginDialog('/contact');
                    break;
                default:
                    session.endDialog('Please select one of the options');
            }
        }

    }
]);

bot.dialog('/work-smarter', [
    (session, args, next) => {

        builder.Prompts.choice(session, 'First of, I always I my frogs in the morning and ofcourse my Inbox is always at Zero.', [
            'Dude!! You eat frogs?',
            'Tell me more about Inbox Zero?',
            'I heard you have a personal assistant?'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });

    },
    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {

                case 0:
                    session.beginDialog('/frogs');
                    break;
                case 1:
                    session.beginDialog('/inboxzero');
                    break;
                case 2:
                    session.beginDialog('/calendarhelp');
                    break;
                default:
                    session.endDialog('Please select one of the options');
            }
        }

    }
]);

bot.dialog('/contact', [
    (session, args, next) => {

        let message = 'I would love to hear from you. You can reach me by e-mail or book 15 minutes in my calendar. Which one do you prefer?';
        if (session.userData.name !== undefined) {
            message = 'I would love to hear from you, ' + session.userData.name + '. You can reach me by e-mail or book 15 minutes in my calendar. Which one do you prefer?'
        }

        builder.Prompts.choice(session, message, [
            'Email',
            'Calendar'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });
    },
    (session, args, next) => {
        if (args.response.entity == 'Calendar') {
            session.endDialog('Cool stuff, you can go to http://aka.ms/meetmichel to schedule.');
            return;
        }
        builder.Prompts.text(session, 'Let me take care of that. What is your e-mail address?')
    },
    (session, args, next) => {
        if (args.response) {
            session.dialogData.email = args.response;
            builder.Prompts.text(session, 'Got it. So what message would you like to send (no pagebreaks needed).');
        }
    },
    (session, args, next) => {
        if (args.response) {
            session.dialogData.text = args.response;

            const nodemailer = require('nodemailer');
            const smtpTransport = require('nodemailer-smtp-transport');

            let transporter = nodemailer.createTransport(smtpTransport({
                host: 'mail.michelbouman.nl',
                port: 587,
                secure: false, // use TLS
                auth: {
                    user: 'bot@michelbouman.nl',
                    pass: 'micboubot'
                },
                tls: {
                    rejectUnauthorized: false // do not fail on invalid certs
                }
            }));

            transporter.verify((error, success) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Server is ready to take our messages');
                }
            });

            const mailOptions = {
                from: session.dialogData.email, // sender address
                to: 'bot@michelbouman.nl', // list of receivers
                subject: 'Bot Mail', // Subject line
                text: session.dialogData.text
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    session.error(error);
                } else {
                    session.endDialog('Thanks' + session.userData.name + ', your message was sent to my inbox and I will reply as soon as possible. Let me know if you want to chat about something else.');
                };
            });

        }

    }
]).triggerAction({ matches: 'Contact' });

bot.dialog('/msft', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'I am a Territory Channel Manager with a focus on the modern workplace, data and artifical intelligence (like this bot). My role is all about enabling digital transformation for businesses in the SMB space with Microsoft partners. Would you like to read more about digital transformation  in SMB?');
    },
    (session, args, next) => {

        if (args.response == true) {
            session.endDialog('My e-book on digital transformation in SMB is almost done and should be available at the end of the summer. Want to chat about something else?')

        } else {
            session.endDialog('Alright. Well, feel free to scroll through my website. If there is anything I can do for you, please let me know.');
        }
    }
]);

bot.dialog('/calendarhelp', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'Yes and no. Cortana helps me schedule all my meetings. She works with Office365 and Gmail. Want in?');
    },
    (session, args, next) => {

        if (args.response == true) {
            session.endDialog('Alright. Go to http://calendar.help and sign up. It is free and works so smooth')

        } else {
            session.endDialog('Alright. Well, feel free to scroll through my website. If there is anything I can do for you, please let me know.');
        }
    }
]);

bot.dialog('/later', [
    function (session) {
        session.endDialog('Ok. Talk to you soon.');
    }
]);

bot.dialog('/frogs', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'Lol, no. It means I do my most annoying to do in the morning. Get it?');
    },
    (session, args, next) => {
        if (args.response == true) {
            session.endDialog('Haha, ok. You should try eating a frog in the morning.')
        } else {
            session.send('Thats ok. I will make sure I write a blog about it soon.');
            session.endDialog('Anything else you want to chat about?');
        }
    }
]);

bot.dialog('/inboxzero', [

    (session, args, next) => {

        session.send('Step 1: Create 3 folders: Action, Wait and Archive');
        session.send('Step 2: Move all e-mails in current subfolders to your archive (your mailbox its search engine is smart enough -trust me.');

        session.sendTyping();

        setTimeout(function () {

            session.send('Step 3: Start going through your inbox and move action items to the action folder and all other mail to archive');

            session.sendTyping();

            setTimeout(function () {
                session.send('Step 4: Set times in your agenda to work on your action folder and to bring your inbox to zero.');
                session.send('Emails that need following up from someone else are moved to the wait folder. I check my action folder once a day and my wait twice a week');

                setTimeout(function () {
                    builder.Prompts.confirm(session, 'This method has helped me a lot since I started working with it about eight years ago. Now I never lose track of actionable emails and I am not being distracted by all the clutter. Get it?');
                }, 1000);

            }, 1250);

        }, 1500);

    },
    (session, args, next) => {
        if (args.response == true) {
            session.endDialog('Nice, I wonder how it works for you! Let me know if you want to discuss something else.')
        } else {
            session.endDialog('No worries, I have a blog coming up on the topic. Want to chat about something else?');
        }
    }
]);