const scheduler = require('node-schedule');
let SCHEDULE = [];

var Recognizers = require('@microsoft/recognizers-text-date-time');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July','August', 'September', 'October', 'November',' December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

module.exports = function(controller) {

    async function addSchedule(schedule) {
        let idx = SCHEDULE.push(schedule);
        SCHEDULE[idx - 1].id = idx;

        if (schedule.type === 'repeating') {
            let cron = schedule.cron;
            scheduler.scheduleJob(`0 ${ cron.minute } ${ cron.hour } ${ cron.dayOfMonth } ${ cron.month } ${ cron.dayOfWeek }`, runSchedule(idx));
        }
        if (schedule.type === 'once') {
            let cron = schedule.cron;
            let date = new Date(2019, cron.month, cron.dayOfMonth, cron.hour, cron.minute, 0);
            scheduler.scheduleJob(date, runSchedule(idx));
        }
    }

    function runSchedule(idx) {
        return async function() {
            schedule = SCHEDULE.filter((item) => { return item.id === idx })[0];
            console.log('RUN SCHEDULE', schedule);
            let bot = await controller.spawn();
            await bot.changeContext(schedule.reference);
            await bot.say('YOU WANTED ME TO REMIND YOU: ' + schedule.subject);
        }
    }

    controller.hears([async(message) => { return message.intent === 'AddReminder' },new RegExp(/^remind me/i)], 'message, direct_message, direct_mention', async(bot, message) => {


        // let local_parse = Recognizers.recognizeDateTime(message.text, Recognizers.Culture.English);
        // console.log('LOCAL PARSE', JSON.stringify(local_parse, null, 2));

        await bot.reply(message,'Sounds like you want to create a reminder!');

        if (message.luis.entities && message.luis.entities.datetime) {
            let schedule = await determineSchedule(message);
            let subject = await determineSubject(message);

            schedule.subject = subject;

            schedule.cron = scheduleToCron(schedule);

            schedule.description = scheduleToDescription(schedule);

            schedule.reference = message.reference;

            await addSchedule(schedule);
            await bot.reply(message, schedule.description);
            // await bot.reply(message, '```' + JSON.stringify(schedule, null, 2) + '```');
        } else {
            await bot.reply(message,'To create a reminder, say something like `remind me to walk the dog every day at 5pm`');
        }

    });

    async function determineSchedule(message) {

        let schedule = {
            type: 'once',
        }

        let times = message.luis.entities.datetime;

        // are any of the datetime entities sets?
        if (times.filter((t) => { return t.type === 'set'}).length) {
            schedule.type = 'repeating';
            schedule.time = getSchedule(times);
        } else {
            // is there just 1 time? if so, get it.
            if (times.length === 1) {
                if (times[0].timex.length > 1) {
                    // TODO: sanity check for "daytime" hours
                }
                schedule.time = timextotime(times[0].timex[0]);
            } else {
                schedule.time = getSchedule(times);
            }

        }

        return schedule;

    }

    function scheduleToDescription(schedule) {

        let time = schedule.time;
        let cron = schedule.cron;
        if (schedule.type === 'once') {
            return "I will remind you about " + schedule.subject + " at " + cron.hour + ":" + cron.minute + " on "  + (cron.month+1) + "/" + cron.dayOfMonth;
        } else {
            let bits = ['I will remind you about ' + schedule.subject];
            if (time.dayofweek) {
                bits.push('every ' + DAYS[time.dayofweek]);
            } else {
                // bits.push('every day');
            }
            if (time.date && time.date !== '*') {
                bits.push('on the ' + time.date);
                if (time.month) {
                    bits.push('of ' + MONTHS[time.month - 1]);
                } else {
                    bits.push('every month');
                }
            } else {
                if (time.month) {
                    bits.push('of ' + MONTHS[time.month - 1]);
                }
            }
            if (time.hour) {
                bits.push('at ' + time.hour + ':' + time.minute || '00');
            } else {
                bits.push('at 9am')
            }

            return bits.join(' ');
        }

    }

    function getSchedule(times) {

        let schedule = {
            timex: times
        }
        
        times.forEach((thistime) => {
            if (thistime.type === 'time') {
                let time = timextotime(thistime.timex[0]);
                for (key in time) {
                    schedule[key] = time[key];
                }
            } else if (thistime.type === 'set') {

                timex = thistime.timex[0];
                // todo: what if there are multiples?

                if (timex.match(/T(\d+)/)) {
                    let match = timex.match(/T(\d+)/);
                    schedule.hour = parseInt(match[1]);
                } else {
                    // TODO: set a sane hour
                    // like, some time from now
                }

                if (timex.match(/T..:(\d+)/)) {
                    let match = timex.match(/T..:(\d+)/);
                    schedule.minute = parseInt(match[1]);
                }

                if (timex.match(/....-W..-(\d)/)) {
                    let match = timex.match(/....-W..-(\d)/);
                    schedule.dayofweek = parseInt(match[1]);
                }

                if (timex.match(/^....-(\d\d)/)) {
                    let match = timex.match(/^....-(\d\d)/);
                    schedule.month = parseInt(match[1]) - 1;
                }
        
                if (timex.match(/^....-..-(\d\d)/)) {
                    let match = timex.match(/^....-..-(\d\d)/);
                    schedule.date = parseInt(match[1]);
                }

                if (timex.match(/P(\d+)D/)) {
                    let match = timex.match(/P(\d+)D/);
                    let interval =  parseInt(match[1]);
                    schedule.interval = interval + ' days';
                    if (interval === 1) {
                        schedule.date = '*';
                    } else {
                        schedule.date = '*/' + interval;
                    }
                }

                if (timex.match(/P(\d+)W/)) {
                    let match = timex.match(/P(\d+)W/);
                    let interval =  parseInt(match[1]);
                    schedule.interval = interval + ' weeks';
                    if (interval === 1) {
                        schedule.dayofweekInterval = '*';
                    } else {
                        schedule.dayofweekInterval = interval;
                    }                
                    if (!schedule.dayofweek) {
                        schedule.dayofweek = 1; // todo: default to monday, but should be relative to today?
                    }
                }

                if (timex.match(/P(\d+)M/)) {
                    let match = timex.match(/P(\d+)M/);
                    let interval =  parseInt(match[1]);
                    schedule.interval = interval + ' months';
                    if (interval === 1) {
                        schedule.month = '*';
                    } else {
                        schedule.month = '*/' + interval;
                    }              
                    if (!schedule.date) {
                        schedule.date = 1; // todo: should this default to today's date? or the 1st?
                    }
                }
            } else if (thistime.type === 'date' || thistime.type === 'datetime') {


                timex = thistime.timex[0];
                // todo: what if there are multiples?

                if (timex.match(/T(\d+)/)) {
                    let match = timex.match(/T(\d+)/);
                    schedule.hour = parseInt(match[1]);
                } else {
                    // TODO: set a sane hour
                    // like, some time from now
                }

                if (timex.match(/T..:(\d+)/)) {
                    let match = timex.match(/T..:(\d+)/);
                    schedule.minute = parseInt(match[1]);
                }

                if (timex.match(/^(\d\d\d\d)-/)) {
                    let match = timex.match(/^(\d\d\d\d)-/);
                    schedule.year = parseInt(match[1]);
                }
        
                if (timex.match(/^....-(\d\d)/)) {
                    let match = timex.match(/^....-(\d\d)/);
                    schedule.month = parseInt(match[1]) - 1;
                }
        
                if (timex.match(/^....-..-(\d\d)/)) {
                    let match = timex.match(/^....-..-(\d\d)/);
                    schedule.date = parseInt(match[1]);
                }

                if (timex.match(/....-W..-(\d)/)) {
                    let match = timex.match(/....-W..-(\d)/);
                    schedule.dayofweek = parseInt(match[1]);
                }

            } else if (thistime.type === 'daterange') {
                timex = thistime.timex[0];
                if (timex.match(/\d\d\d\d-W(\d+)/)) {
                    let match = timex.match(/\d\d\d\d-W(\d+)/);
                    schedule.weekNumber = parseInt(match[1]);
                }
                if (timex.match(/....-(\d+)/)) {
                    let match = timex.match(/....-(\d+)/);
                    schedule.month = parseInt(match[1]);
                }

            }
        });

        return schedule;

    }

    function timextotime(timex) {

        let time = {
        }

        time.timex = timex;

        if (timex.match(/T(\d+)/)) {
            let match = timex.match(/T(\d+)/);
            time.hour = parseInt(match[1]);
        } else {
            // TODO: set a sane hour
            // like, some time from now
        }

        if (timex.match(/T..:(\d+)/)) {
            let match = timex.match(/T..:(\d+)/);
            time.minute = parseInt(match[1]);
        }


        if (timex.match(/^(\d\d\d\d)-/)) {
            let match = timex.match(/^(\d\d\d\d)-/);
            time.year = parseInt(match[1]);
        }

        if (timex.match(/^....-(\d\d)/)) {
            let match = timex.match(/^....-(\d\d)/);
            time.month = parseInt(match[1]) - 1;
        }

        if (timex.match(/^....-..-(\d\d)/)) {
            let match = timex.match(/^....-..-(\d\d)/);
            time.date = parseInt(match[1]);
        }

        if (timex.match(/....-W..-(\d)/)) {
            let match = timex.match(/....-W..-(\d)/);
            time.dayofweek = parseInt(match[1]);
        }

        if (timex.match(/\d\d\d\d-W(\d+)/)) {
            let match = timex.match(/\d\d\d\d-W(\d+)/);
            time.weekNumber = parseInt(match[1]);
            // translate this to the day and month
        }

        return time;

    }


    async function determineSubject(message) {

        let subject = '';
        if (message.luis && message.luis.entities && message.luis.entities.Subject) {
            subject = message.luis.entities.Subject[0];
        } else {
            subject = message.text;
        }
        return subject;

    }

    function scheduleToCron(schedule) {

        let today = new Date();
        let cron = {
            minute: '*',
            hour: '*',
            dayOfMonth: '*',
            month: '*',
            dayOfWeek: '*',
        }

        // if a weeknumber is specified, resolve that. 
        // this happens with "next week" - we take that to mean next week on monday For now
        // todo: maybe make this next week but same day?
        if (schedule.time.weekNumber) {
            let weekdate = getDateOfISOWeek(schedule.time.weekNumber, '2019'); // todo set to current year
            schedule.time.date = weekdate.getDate();
            schedule.time.month = weekdate.getMonth();
        }

        // console.log('translate', schedule);

        // if a specific hour was specified, set it.
        // otherwise, default to 9am
        if (schedule.time.hour) {
            cron.hour = schedule.time.hour;
        } else {
            cron.hour = 9;
        }

        // if a specific minute was specified, set it.
        // otherwise, default to the top of the hour
        if (schedule.time.minute) {
            cron.minute = schedule.time.minute;
        } else {
            cron.minute = 0;
        }

        if (schedule.time.month) {
            cron.month = schedule.time.month;
        }

        if (schedule.time.date) {
            cron.dayOfMonth = schedule.time.date;
        }

        if (schedule.time.dayofweek) {
            cron.dayOfWeek = schedule.time.dayofweek;
            if (schedule.type === 'once') {
                // find next occurence of this date and make it specific
                let weekdate = getNextDayOfWeek(today, cron.dayOfWeek);
                cron.dayOfMonth = weekdate.getDate();
                cron.month = weekdate.getMonth();
                cron.dayOfWeek = '*'; 
            }
        }

        if (schedule.time.dayofweekInterval && schedule.time.dayofweekInterval > 1) {
            cron.dayOfWeek = cron.dayOfWeek + '/' + schedule.time.dayofweekInterval;
        }

        if (schedule.type === 'once') {
            if (cron.month === '*') {
                cron.month = today.getMonth();
            }
            if (cron.dayOfMonth === '*') {
                cron.dayOfMonth = today.getDate();
            }
        }

        return cron;
    }

}


// Source: https://stackoverflow.com/questions/16590500/javascript-calculate-date-from-week-number
function getDateOfISOWeek(w, y) {
    var simple = new Date(y, 0, 1 + (w - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

// source: https://codereview.stackexchange.com/questions/33527/find-next-occurring-friday-or-any-dayofweek
function getNextDayOfWeek(date, dayOfWeek) {
    // Code to check that date and dayOfWeek are valid left as an exercise ;)

    var resultDate = new Date(date.getTime());

    resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);

    return resultDate;
}