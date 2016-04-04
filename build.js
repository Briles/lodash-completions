(function () {
  'use strict';

  const request = require('request');
  const marked = require('marked');
  const commander = require('commander');
  const cheerio = require('cheerio');
  const path = require('path');
  const fs = require('fs');

  var writeCompletions = function (filename, contents) {
    filename = filename.toLowerCase();
    var destPath = path.join(__dirname, '/completions/', filename + '.sublime-completions');

    fs.writeFile(destPath, JSON.stringify(contents, null, 4), function (err) {
      if (err) {
        return console.log(err);
      }

      console.log('Completions saved to "' + destPath + '"');
    });
  };

  var getDocumentationUrl = function (version) {
    return 'https://raw.githubusercontent.com/lodash/lodash/#/doc/README.md'.replace('#', version);
  };

  var getDocumentation = function (callback) {
    var url = getDocumentationUrl(commander.tag);

    request(url, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        callback(marked(body));
      } else if (response.statusCode === 404) {
        return console.log('Version "' + commander.tag + '" could not be found.');
      }
    });
  };

  var parseDocumentation = function (html) {
    var $ = cheerio.load(html);
    var numCompletions = 0;

    $('h2').each(function () {
      if ($(this).next().is('h3')) {
        numCompletions += 1;

        var completionsData = {
          scope: 'source.js, source.coffee',
          completions: [],
        };

        var group = $(this).text().replace(/(“|” Methods)/gi, '').trim();

        var codeSnippets = $(this).nextUntil('h2', 'h3');
        codeSnippets.each(function () {
          var trigger = $(this).text().trim();

          var hasParams = trigger.match(/(?=\(([^)]+)\))/g);
          var contents = trigger;

          if (trigger[0] === '_') {
            var len = trigger.length;
            trigger = commander.namespace + trigger.substring(1, len);
          }

          if (hasParams) {

            if (commander.omitParams) {
              trigger = trigger.replace(/(\([^)]*\))/g, '()');
            }

            $(this).nextUntil('ol').next().children('li').each(function (i) {
              i = i + 1;
              var code = $(this).children('code').first().text();
              contents = contents.replace(code, '${' + i + ':' + code + '}');
            });

          }

          var completion = {
            trigger: trigger + '\t _ ' + group,
            contents: contents + '$0',
          };

          completionsData.completions.push(completion);
        });

        writeCompletions(group, completionsData);
      }
    });
  };

  commander
    .version('1.0.0')
    .usage('Generates completions for lodash using "' + getDocumentationUrl('master') + '"')
    .option('-t --tag [tag]', 'lodash version to fetch', 'master')
    .option('-n --namespace [namespace]', 'namespace to use in place of _', 'ld')
    .option('-o --omit-params [omitParams]', 'don\'t write params within triggers', false)
    .parse(process.argv);

  getDocumentation(parseDocumentation);
}());
