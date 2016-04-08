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
          var func = trigger.match(/[\w\.]+/g)[0];
          console.log(func);
          var hasPrefix = false;
          var hasParams = trigger.match(/(?=\(([^)]+)\))/g);
          var contents = trigger;

          if (trigger[0] === '_') {
            hasPrefix = true;
            trigger = commander.namespace + trigger.slice(1);
          }

          var headings = $(this).nextUntil('h3', 'h4');

          var aliases = [];

          headings.each(function () {
            var heading = $(this).text().trim();
            if (heading === 'Aliases' && $(this).next().is('p')) {
              aliases = $(this).next().text().split(',').map(t => t.trim());
            }
          });

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

          aliases.forEach(function (alias) {
            var unPrefixedAlias = alias.replace('_.', '.');
            var unPrefixedFunc = func.replace('_.', '.');
            var aliased = JSON.parse(JSON.stringify(completion));

            aliased.trigger = aliased.trigger.replace(unPrefixedFunc, unPrefixedAlias);
            aliased.contents = aliased.contents.replace(unPrefixedFunc, unPrefixedAlias);
            completionsData.completions.push(aliased);

            var unPrefixedAliased = JSON.parse(JSON.stringify(aliased));
            unPrefixedAliased.trigger = 'c' + unPrefixedAliased.trigger;
            unPrefixedAliased.contents = hasPrefix === true ? unPrefixedAliased.contents.slice(1) : unPrefixedAliased.contents;
            completionsData.completions.push(unPrefixedAliased);
          });

          var unPrefixed = JSON.parse(JSON.stringify(completion));

          unPrefixed.trigger = 'c' + unPrefixed.trigger;
          unPrefixed.contents = hasPrefix === true ? unPrefixed.contents.slice(1) : unPrefixed.contents;

          completionsData.completions.push(unPrefixed);
        });

        writeCompletions(group, completionsData);
      }
    });
  };

  commander
    .version('1.0.0')
    .usage('Generates completions for lodash')
    .option('-t --tag [tag]', 'lodash version to fetch (must be valid git tag)', 'master')
    .option('-n --namespace [namespace]', 'namespace to use in place of `_`', 'ld')
    .option('-o --omit-params [omitParams]', 'don\'t write params within triggers', true)
    .parse(process.argv);

  getDocumentation(parseDocumentation);
}());
