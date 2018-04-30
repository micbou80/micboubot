const AttachmentDetection = () => {

    return {
        botbuilder: (session, next) => {

            // Check if sessions contains attachments
            if (session.message.attachments === undefined) {
                next();
                return;
            }

            // Check if valid attachment
            if (session.message.attachments.length > 0 &&
                session.message.attachments[0].contentType.indexOf('image') !== -1) {
                session.sendTyping();
                session.send(`I received your image. Let's have a look!`);

                session.beginDialog('/image-received', { attachment: session.message.attachments[0] })
            } else {
                next();
            }

        }
    }

}

module.exports.AttachmentDetection = AttachmentDetection;  
