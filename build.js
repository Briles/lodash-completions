(function() {
  'use strict';

  const request = require('request');
  const marked = require('marked');
  const commander = require('commander');
  const cheerio = require('cheerio');
  const path = require('path');
  const fs = require('fs');

  var writeCompletions = function(filename, contents) {
    var destPath = path.join(__dirname, filename.toLowerCase() + '.sublime-completions');

    fs.writeFile(destPath, JSON.stringify(contents, null, 4), function(err) {
      if (err) {
        return console.log(err);
      }

      console.log('Completions saved to "' + destPath + '"');
    });
  };

  var getDocumentationUrl = function(version) {
    return 'https://raw.githubusercontent.com/lodash/lodash/#/doc/README.md'.replace('#', version);
  };

  var getDocumentation = function(callback) {
    var url = getDocumentationUrl(commander.tag);

    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        callback(marked(body));
      } else if (response.statusCode === 404) {
        return console.log('Version "' + commander.tag + '" could not be found.');
      }
    });
  };

  var parseDocumentation = function(html) {
    var $ = cheerio.load(html);

    $('h2').each(function() {
      if ($(this).next().is('h3')) {
        var completionsData = {
          scope: 'source.js',
          completions: [],
        };

        var group = $(this).text().replace(/(“|” Methods)/gi, '').trim();

        var codeSnippets = $(this).nextUntil('h2', 'h3');
        codeSnippets.each(function() {
          var completion = {};

          var trigger = $(this).text() + '\t _ ' + group;

          if (trigger[0] === '_') {
            var len = trigger.length;
            trigger = commander.namespace + trigger.substring(1, len);
          }

          completion.trigger = trigger;

          var codeArgs = $(this).nextUntil('ol').next().find('li').map(function() {
            return $(this).find('code').text();
          }).get();

          var tabArgs = codeArgs.map(function(el, i) {
            return '${' + (i + 1) + ':' + el + '}';
          }).join(', ');

          completion.contents = $(this).text().replace(codeArgs.join(', '), tabArgs) + '$0';
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
    .parse(process.argv);

  getDocumentation(parseDocumentation);
}());
