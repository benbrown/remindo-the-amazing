const { LuisRecognizer } = require('botbuilder-ai');

module.exports = function(controller) {

    if (process.env.LUIS_APPLICATIONID) {

        const recognizer = new LuisRecognizer({
            applicationId: process.env.LUIS_APPLICATIONID,
            endpointKey: process.env.LUIS_ENDPOINTKEY,
        },{
            timezoneOffset: -5 * 60,
        }, true);


        controller.middleware.ingest.use(async (bot, message, next) => {
            if (message.incoming_message.type === 'message') {
                const results = await recognizer.recognize(message.context);
                message.intent = LuisRecognizer.topIntent(results, 'None', process.env.LUIS_THRESHOLD || 0.7);
                message.luis = results;
                // console.log(JSON.stringify(results, null, 2));
            }

            next();
        });

    }

}