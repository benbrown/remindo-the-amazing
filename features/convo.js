const { BotkitConversation } = require('botkit');

module.exports = function(controller) {

    let dialog = new BotkitConversation('foo', controller);
    controller.addDialog(dialog);
    dialog.ask({
        text: ['do you foo?'],
        attachments: [
            {
                title: 'Hello',
                subtitle: 'This is an attachment',
                callback_id: 'foo',
                actions: [
                    {
                        type: 'button',
                        text: 'button',
                        value: 'value',
                    }
                ]
            }
        ]}, [], 'foo');
    dialog.say('ok yay');
    
    controller.hears('foo', 'message', async(bot, message) => { 
        await bot.beginDialog('foo');
    })
}