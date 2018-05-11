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

const AttachmentDetection = require('./middleware/image-middleware').AttachmentDetection;

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
} else {
    module.exports = connector.listen();
}

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));
bot.use(builder.Middleware.sendTyping());
bot.use(AttachmentDetection());
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


//@TODO Add Project Peronality Chat
//@TODO Cognitive services toevoegen


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
                        .text('Hey! Welcome to my bot. Its still very much under construction..')
                );

                bot.send({ type: 'typing', address: message.address });

                const welcomeMessage = new builder.Message()
                    .address(message.address)
                    .text('My name is Michel. I am a proud husband, father of 4, student and Microsoft employee.');

                const welcomeMessage2 = new builder.Message()
                    .address(message.address)
                    .text('As you can imagine my life is quite hectic, so I am also very much into productivity hacks.');

                const welcomeMessage3 = new builder.Message()
                    .address(message.address)
                    .text('Feel like chatting today?');

                setTimeout(() => {
                    bot.send(welcomeMessage);
                    bot.send({ type: 'typing', address: message.address });

                    setTimeout(() => {
                        bot.send(welcomeMessage2);
                        bot.send({ type: 'typing', address: message.address });

                        setTimeout(() => {
                            bot.send(welcomeMessage3);
                        }, 3000)
                    }, 3000)
                }, 3000)
            }
        });
    }
});

bot.dialog('/name', [
    (session, args, next) => {
        builder.Prompts.text(session, "Ok, but first whats your name or what may I call you?");
    },
    (session, args, next) => {
        if (args.response) {
            session.userData.name = args.response;
            session.endDialog('Welcome to the site %s. Lets chat!', session.userData.name);
        } else {
            next();
        }
    }
]);

// Default Dialog
bot.dialog('/', [
    (session, args, next) => {
        if (session.userData.name !== undefined) {
            session.send('Hey wait a minute. I recognize you, %s right? I am excited to see you back here', session.userData.name);
            next();
        }
        
    },
    (session, args, next) => {
        if (args.response !== undefined) {
            session.userData.name = args.response;
            session.send('Welcome to the site %s. Lets chat', session.userData.name);
            next();
        }
        
        

        builder.Prompts.choice(session, 'What would you like to talk about?', [
            'Tell me about your work experience',
            'Lets play a game (under construction)',
            'Any productivity tips?',
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
                    session.beginDialog('/game');
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
    session.sendTyping();
    setTimeout(function () {
    session.send('My dog used to chase people on a bike a lot. It got so bad, finally I had to take his bike away. ');
    
    session.sendTyping();
    setTimeout(function () {
    session.endDialog('Ok, my sense of humor needs some more coding')
}, 3000);
                                 
}, 5000);

}).triggerAction({
    matches: ['Joke']
});



// Unknown Dialog
bot.dialog('/unknown', (session) => {
    const msg = new builder.Message(session)
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
    session.endDialog('You can ask me about work, productivity, getting in touch and I am learning new small talk all the time');
}).triggerAction({ matches: 'Help' });




// Experience Waterfall
bot.dialog('/experience', [
    (session, args, next) => {
        session.sendTyping();
        setTimeout(function () {
        session.send('I have been working for the Dutch subsidiary of Microsoft since 2013. ');
      
            session.sendTyping();
            setTimeout(function () {
            session.send('Before my role at Microsoft I have had sales- and people management roles');

                session.sendTyping();
                setTimeout(function () {
                builder.Prompts.choice(session, 'In short; 18 years of work experience of which 12 years in sales-/people management.', [
                'What do you do at Microsoft?',
                'Where did you work before Microsoft?',
                'I would like to get in touch with you.'
                ], { listStyle: builder.ListStyle.button, maxRetries: 2 });
            }, 2500);
        }, 2500);
    }, 2500);
        
},

                                 

    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {
                case 0:
                    session.beginDialog('/msft');
                    break;
                case 1:
                    session.beginDialog('/LinkedIN');
                    break;
                case 2:
                    session.beginDialog('contact');
                    break;
                default:
                    session.endDialog('Please select one of the options');
            }
        }

    }
]);

bot.dialog('/LinkedIN', [
    (session, args, next) => {
        const card = new builder.HeroCard(session)
            .title('Michel Bouman at LinkedIN')
            .subtitle('(View on Microsoft Pulse blogsite)')
            .text('You can find my full profile on LinkedIN.')
            .images([
                builder.CardImage.create(session, 'http://www.michelbouman.nl/inboxzeroblog.png')
            ])
            .buttons([
                builder.CardAction.openUrl(session, 'https://www.linkedin.com/in/michelbouman/', 'Check out full profile')
            ]);

        const msg = new builder.Message(session).addAttachment(card);

        session.endDialog(msg);
    }
]);

bot.dialog('/msft', [
    (session, args, next) => {
        session.sendTyping();
        setTimeout(function () {
        session.send('I am Territory Channel Manager.');
        
            session.sendTyping();
            setTimeout(function () {
                session.send('The role sits right in between our customers and our partners...');

                    session.sendTyping();
                setTimeout(function () {
                    session.send('Basically, I connect partner solutions on Microsoft technology to customer needs...');

                    session.sendTyping();
                    setTimeout(function () {
                        session.send('My focus is on the Modern Workplace and on Artificial Intelligence.');

                    builder.Prompts.choice(session, 'so', [
                        'A.I. from the Sci-fi movies?',
                        'Whats a modern workplace?',
                        'I would like to get in touch with you.'
                    ], { listStyle: builder.ListStyle.button, maxRetries: 2 });

                    }, 2500);
        }, 2500);
    }, 2500);
}, 2500);
        
},




    (session, args, next) => {
        if (args.response.index !== undefined) {
            switch (args.response.index) {
                case 0:
                    session.beginDialog('/ai');
                    break;
                case 1:
                    session.beginDialog('/modernworkplace');
                    break;
                case 2:
                    session.beginDialog('/contact');
                    break;
                default:
                    session.endDialog('Please select one of the options');
            }
        }

    }
]).triggerAction({ matches: 'Work' });

bot.dialog('/ai', [
    (session, args, next) => {
        session.sendTyping();
    setTimeout(function () {
        session.send("Haha, no...wait, check this out.");
    }, 1500);
    next();
    },

    
    (session, args, next) => {
        const card = new builder.VideoCard(session)
            .title('The animated guide to artificial intelligence')
            .subtitle('(Explanimators: Episode 1)')
            .text('Watch this easy guide to everything AI. Its from Microsoft Story Labs...')
            .image(builder.CardImage.create(session, 'https://www.coolermedia.nl/wp-content/uploads/2017/08/4nsilupnry0.jpg'))
            .media([
                { url: 'https://www.youtube.com/watch?v=4NsilUpnRY0&t=2s?autoplay=1' }
            ])
            .buttons([
                builder.CardAction.openUrl(session, 'https://www.microsoft.com/en-us/ai/', 'Learn More')
            ]);

        const msg = new builder.Message(session).addAttachment(card);

        session.endDialog(msg);
    }
]);



bot.dialog('/modernworkplace', [
    (session, args, next) => {
        session.sendTyping();
    setTimeout(function () {
        session.send("To me, its a workplace that empowers everyone to be creative and work together, securely. Check out this vid.");
    }, 1500);
    next();
    },
    (session, args, next) => {
        const card = new builder.VideoCard(session)
            .title('Modern Workplace')
            .subtitle('(Explanimators: Episode 1)')
            .text('To me, the modern workplace is a workplace that empowers everyone to be creative and work together, securely. So being able to get more done, work better together while safeguarding your data')
            .image(builder.CardImage.create(session, 'https://www.coolermedia.nl/wp-content/uploads/2017/08/4nsilupnry0.jpg'))
            .media([
                { url: 'https://www.youtube.com/watch?v=rW-r86Yj1W4' }
            ])
            .buttons([
                builder.CardAction.openUrl(session, 'https://resources.office.com/en-us-landing-DemoIntroducingMicrosoft365Business.html', 'Check out the demo')
            ]);

        const msg = new builder.Message(session).addAttachment(card);

        session.endDialog(msg);
    }
]);



// Productivity Waterfall

bot.dialog('/work-smarter', [
    (session, args, next) => {
        builder.Prompts.choice(session, 'First of, I always I my frogs in the morning and ofcourse my Inbox is always at Zero.', [
            'Dude!! You eat frogs?',
            'Tell me more about Inbox Zero!',
            'I heard you have a personal assistant?',
            
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
]).triggerAction({ matches: 'Productivity' });




bot.dialog('/calendarhelp', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'Yes and no. Cortana helps me schedule all my meetings. She works with Office365 and Gmail. Want in?');
    },
    (session, args, next) => {
        if (args.response == true) {
            session.endDialog('Alright. Go to http://calendar.help and sign up. It is free (use code CupcakeFrosting to get full access)')
        } else {
            session.endDialog('Alright. Well, feel free to scroll through my website. If there is anything I can do for you, please let me know.');
        }
    }
]);



bot.dialog('/frogs', [
    (session, args, next) => {
        builder.Prompts.confirm(session, 'Lol, no. It means I complete my energy drainers in the morning. Get it?');
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
        session.sendTyping();

        setTimeout(function () {
            session.send('Step 2...');
            session.sendTyping();

            setTimeout(function () {
                session.send('Move all e-mails in current subfolders to your archive (your mailbox its search engine is smart enough -trust me.');
                session.sendTyping();
            
                setTimeout(function () {
                    session.send('Step 3...');
                    session.sendTyping();

                    setTimeout(function () {

                        session.send('Start going through your inbox and move action items to the action folder and all other mail to archive');
                        session.sendTyping();

                        setTimeout(function () {
                            session.send('Step 4...');
                            session.sendTyping();

                            setTimeout(function () {
                                 session.send('Set times in your agenda to work on your action folder and to bring your inbox to zero.');
                                 session.sendTyping();

                                setTimeout(function () {    
                                session.send('Emails that need following up from someone else are moved to the wait folder. I check my action folder once a day and my wait twice a week');
                                    session.sendTyping();

                                    setTimeout(function () {    
                                        session.send('This method has helped me a lot since I started working with it about eight years ago. Now I never lose track of actionable emails and I am not being distracted by all the clutter. ');
                                        session.sendTyping();

                                        setTimeout(function () {
                                            builder.Prompts.confirm(session, 'Get it? I have a blog (in Dutch) care to read it?');
                                        }, 1000);
                                 
                                    }, 3000);

                                  }, 1000);

                            }, 2500);

                        }, 2500);

                   }, 2500);

                }, 3000);

           }, 3000);

        }, 1000);
  
},
    (session, args, next) => {
        if (args.response == true) {
            session.beginDialog('/0blog');
            } else {
            session.endDialog('Ok.Let me know if you want to discuss something else.')
            
        }
    }
]);

bot.dialog('/0blog', [
    (session, args, next) => {
        const card = new builder.HeroCard(session)
            .title('Met ‘Inbox Zero’ altijd een lege mailbox')
            .subtitle('(View on Microsoft Pulse blogsite)')
            .text('Een lege, opgeruimde en overzichtelijke mailbox. Wie wil dat niet? Klaar met al die ongelezen- en to-do mails die maar in m’n inbox bleven hangen en alle energie die het soms kostte om te achterhalen of die ene collega gereageerd had. Bij de zoektocht kwam ik de ‘Inbox Zero’ methode van Merlin Mann tegen. Deze methode is een handzame manier om je inbox zo in te richten, dat deze niet alleen leeg is, maar waarbij je ook een duidelijk overzicht hebt van welke openstaande acties er in je mailbox zitten en op welke e-mails jij nog antwoord moet krijgen.')
            .images([
                builder.CardImage.create(session, 'http://www.michelbouman.nl/inboxzeroblog.png')
            ])
            .buttons([
                builder.CardAction.openUrl(session, 'https://pulse.microsoft.com/nl-nl/work-productivity-nl-nl/na/met-inbox-zero-altijd-een-lege-mailbox/', 'Read the blog')
            ]);

        const msg = new builder.Message(session).addAttachment(card);

        session.endDialog(msg);
    }
]);

// Contact Waterfall

bot.dialog('/contact', [
    (session, args, next) => {

        let message = 'I would love to hear from you. You can reach me by e-mail or book 15 minutes in my calendar. Which one do you prefer?';
        if (session.userData.name !== undefined) {
            message = 'I would love to hear from you, ' + session.userData.name + '. You can reach me by e-mail or book 15 minutes in my calendar. Which one do you prefer?'
        }

        builder.Prompts.choice(session, message, [
            'Email',
            'Schedule 15 minutes'
        ], { listStyle: builder.ListStyle.button, maxRetries: 2 });
    },
    (session, args, next) => {
        if (args.response.entity == 'Schedule 15 minutes') {
            session.replaceDialog('/15min');
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
                    pass: process.env.EmailPassword
                },
                tls: {
                    rejectUnauthorized: false // do not fail on invalid certs
                }
            }));

            transporter.verify((error, success) => {
                if (error) {
                    session.error(error);
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


bot.dialog('/15min', [
    (session, args, next) => {
        const card = new builder.HeroCard(session)
            .title('Schedule a 15-minute meeting with me')
            .subtitle('(Powered by Microsoft Bookings)')
            .text('I use Microsoft Bookings for this. It simplifies how customers schedule and manage appointments. Customers love the flexibility, convenience, and control they get with Bookings. They can visit your booking page whenever they want, book the time and service they need, get a confirmation email and calendar invitation, and reschedule or cancel if they must. Try it for yourself with my calendar.')
            .images([
                builder.CardImage.create(session, 'http://www.michelbouman.nl/calendar.png')
            ])
            .buttons([
                builder.CardAction.openUrl(session, 'http://aka.ms/meetmichel', 'Schedule now')
            ]);

        const msg = new builder.Message(session).addAttachment(card);

        session.endDialog(msg);
    }
]);

// Cognitive Services Game
bot.dialog('/game', (session) => {

    session.sendTyping();
    setTimeout(function () {
    session.send('Lets start by you uploading a picture');

    session.sendTyping();
    setTimeout(function () {
    session.send('Then I will guess what you have uploaded');

    session.sendTyping();
    setTimeout(function () {
    session.endDialog('and no worries, I am not saving your picture')

    session.sendTyping();
    setTimeout(function () {
    session.send('Im at work, so keep it clean');

    session.sendTyping();
    setTimeout(function () {
    session.send('You can upload by clicking the bottom left picture')

    

    }, 2500);
    }, 2500);
    }, 2500);
    }, 2500);
    }, 2500);

}).triggerAction({ matches: 'Game' });

bot.dialog('/image-received', [
    (session, args, next) => {
        const attachment = args.attachment;
        console.log(attachment);

        session.endDialog('This part is under construction, but soon I will be showing of my cognitive skills');
    }
]);