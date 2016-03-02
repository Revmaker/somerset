/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit is has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

# SAM added:
- Make the bot summarize and extract text with aylien
- quote somerset maugham
- recognize more greetings, and respond with more variety

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');
/* SAM ADDITIONS */
var _ = require('lodash');
var AYLIENTextAPI = require('aylien_textapi');
var textapi = new AYLIENTextAPI({
  application_id: '43e52631',
  application_key: '9d8f9559517a6ebf279f5fadd26687b1'
});

var SOMERSET_QUOTES = [
  "The love that lasts longest is the love that is never returned.",
  "People ask for criticism, but they only want praise.",
  "Excess on occasion is exhilarating. It prevents moderation from acquiring the deadening effect of a habit.",
  "There is hardly anyone whose sexual life, if it were broadcast, would not fill the world at large with surprise and horror.",
  "At a dinner party one should eat wisely but not too well, and talk well but not too wisely.",
  "We are not the same persons this year as last; nor are those we love. It is a happy chance if we, changing, continue to love a changed person."
];
var DEFAULT_SUMMARY = 'I failed to summarize! I have dishonored my family! :skull_and_crossbones:';
var SUMMARY_LENGTH = 7;//measured in sentences;

var greetingString = "^(hey|sup|hello|hola|yo|howdy|hi)"
var greetingArray = ["hey","sup","hello","hola","yo","howdy","hi"];//this could be a subset, in case you want to hear, but not say certain greetings
/* end additions */

var controller = Botkit.slackbot({
    debug: process.env.debug ? process.env.debug : false,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

var extendedUtterances = Object.assign(bot.utterances, {
  greeting: new RegExp(greetingString, "i")
});

bot.utterances = extendedUtterances; //override here and not in original code in case of updates

controller.hears([greetingString],'direct_message,direct_mention,mention',function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    },function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(',err);
        }
    });


  controller.storage.users.get(message.user,function(err, user) {
    var greet = _.sample(greetingArray);
    greet = greet.charAt(0).toUpperCase() + greet.slice(1);

    if (user && user.name) {
        bot.reply(message,greet + ' ' + user.name + '!!');
    } else {
        bot.reply(message,greet + '.');
    }
  });
});

controller.hears(['call me (.*)'],'direct_message,direct_mention,mention',function(bot, message) {
    var matches = message.text.match(/call me (.*)/i);
    var name = matches[1];
    controller.storage.users.get(message.user,function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user,function(err, id) {
            bot.reply(message,'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name','who am i'],'direct_message,direct_mention,mention,ambient',function(bot, message) {

    controller.storage.users.get(message.user,function(err, user) {
        if (user && user.name) {
            bot.reply(message,'Your name is ' + user.name);
        } else {
            bot.reply(message,'I don\'t know yet!');
        }
    });
});
/* sam additions */

function summarizeAsync(paramsObj) {
  return new Promise(function(resolve, reject) {
    textapi.summarize(paramsObj,function(err,response) {
        if(err !== null){
          return reject(err);
        }
        resolve(response);
    });
  });
};

function getUrlToSummarize(message) {
  var matches = message.text.match(/summarize (.*)/i)
              ? message.text.match(/summarize (.*)/i)
              : message.text.match(/need a summary of (.*)/i);
  return matches[1].slice(1,-1); //remove <> that auto-wrap it for some reason, probably slack internal stuff
}

controller.hears(['your purpose'],'direct_message,direct_mention,mention',function(bot, message) {
  controller.storage.users.get(message.user,function(err, user) {
      bot.reply(message,'What is my purpose...? \n https://www.youtube.com/watch?v=wqzLoXjFT34');
  });
});

controller.hears(['summarize (.*)', 'need a summary of (.*)'],'direct_message,direct_mention,mention,ambient',function(bot, message) {
  var url = getUrlToSummarize(message);
  if(url.indexOf('http') === -1) return bot.reply(message, 'Hey, uhm, if that was directed at me, I can only sumarize URLs.');

  bot.reply(message, "I will read that and give you a summary! One moment...");
  var summaryParams = {
    url: url,
    sentences_number: SUMMARY_LENGTH
  };//this is how textAPI likes its parameters delivered
  var summary = DEFAULT_SUMMARY;

  summarizeAsync(summaryParams).then(function(response) {
    bot.startConversation(message, function (err, convo) {
      if (err) throw err;
      summary = response.sentences.join('\n\n - ');
      convo.sayFirst('Alright, here is a summary!\n');
      convo.say(summary);

      convo.ask('Would you also like me to classify that article?', [
        {
          pattern: bot.utterances.yes,
          callback: function(response, convo) {
            convo.sayFirst('Alright, one classification, coming right up!');
            textapi.classify({
              url: url
            }, function(err, response) {
              convo.say(response.categories[0].label);
              convo.say("Aren't I so helpful? :smirk:");
              convo.next();
            })
          }
        },
        {
          pattern: bot.utterances.no,
          callback: function(response, convo) {
            convo.say(':ok_hand:');
            convo.next();
          }
        },
        {
          default: true,
          callback: function(response,convo) {
            convo.say(':robot_face: :thinking_face:\nSorry, I didn\'t catch that...');
            convo.repeat();
            convo.next();
        }
      }
      ]);
    });
  }).catch(function(e){
    console.log(e);
  });
});

controller.hears(['quote', 'quotation', 'maugham'],'direct_message,direct_mention,mention', function(bot, message) {
  bot.reply(message, 'As my namesake said, "' + _.sample(SOMERSET_QUOTES) + '"');
});

/* END sam additions */

controller.hears(['shutdown'],'direct_message,direct_mention,mention',function(bot, message) {

    bot.startConversation(message,function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?',[
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    },3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot, message) {

    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name + '>. I have been running for ' + uptime + ' on ' + hostname + '.');

});

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
