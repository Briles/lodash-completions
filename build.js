(function () {
  'use strict';

  const cheerio = require('cheerio');
  const commander = require('commander');
  const fs = require('fs');
  const https = require('https');
  const marked = require('marked');

  commander
    .version('1.0.0')
    .usage('Generates completions for lodash')
    .option('-t --tag [tag]', 'lodash version to fetch (must be valid git tag)', 'master')
    .option('-n --namespace [namespace]', 'namespace to use in place of `_`', 'ld')
    .parse(process.argv);

  const isFunctionRe = new RegExp('\\(.*\\)');
  const hasParamsRe = new RegExp('\\([^)]+\\)');
  const replacee = '~#~';
  const configurations = [{
    triggerPrefix: commander.namespace,
    completionPrefix: '_',
  }, {
    triggerPrefix: 'c' + commander.namespace,
    completionPrefix: '',
  }, ];

  var writeCompletions = function (filename, contents) {
    filename = filename.toLowerCase();
    var destPath = `${__dirname}/completions/${filename}.sublime-completions`;

    fs.writeFile(destPath, JSON.stringify(contents, null, 4), function (err) {
      if (err) {
        return console.log(err);
      }

      console.log(`Saved "${destPath}"`);
    });
  };

  var parse = function (html) {
    var $ = cheerio.load(html);

    $('h2').each(function () {
      if ($(this).next().is('h3')) {

        var completionsData = {
          scope: 'source.js, source.coffee',
          completions: [],
        };

        var group = $(this).text().replace(/(“|” Methods)/gi, '').trim();

        $(this).nextUntil('h2', 'h3').each(function () {
          var base = $(this).text().replace(/\(.*\)/, `(${replacee})`).trim().slice(1);
          var isFunction = isFunctionRe.test(base);
          var hasParams = hasParamsRe.test($(this).text());

          var parameters = [];

          if (hasParams) {
            $(this).nextUntil('ol').next().children('li').each(function (i) {
              i += 1;
              parameters.push('${' + i + ':' + $(this).children('code').first().text() + '}');
            });

            parameters = parameters.join(', ');
          }

          var aliases = [base];

          $(this).nextUntil('h3', 'h4').each(function () {
            if ($(this).text().trim() === 'Aliases' && $(this).next().is('p')) {
              aliases.push(...($(this).next().text().split(',').map(function (alias) {
                alias = alias.trim();

                if (alias.slice(0, 1) !== '_') {
                  alias = '_' + alias;
                }

                return (isFunction ? alias + `(${replacee})` : alias).trim().slice(1);
              })));
            }
          });

          aliases.forEach(function (alias) {
            var trigger = alias.replace(replacee, '');
            var contents = alias.replace(replacee, parameters);

            console.log(trigger);

            configurations.forEach(function (config) {
              var completion = {
                trigger: `${config.triggerPrefix + trigger}\t _ ${group}`,
                contents: `${config.completionPrefix + contents}$0`,
              };

              completionsData.completions.push(completion);
            });
          });
        });

        writeCompletions(group, completionsData);
      }
    });
  };

  (function () {
    var url = `https://raw.githubusercontent.com/lodash/lodash/${commander.tag}/doc/README.md`;

    https.get(url, (res) => {
      var body = '';

      res.on('data', (d) => {
        body += d;
      });

      res.on('end', function () {
        parse(marked(body));
      });

    }).on('error', (e) => {
      console.error(e);
    });
  }());
}());
