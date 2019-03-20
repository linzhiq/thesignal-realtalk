// our dependencies
const express = require('express');
const bodyParser = require('body-parser');
const escape = require('escape-html');
const admin = require('@tryghost/admin-api');
const converter = require('@tryghost/html-to-mobiledoc');
const grecaptcha = require('grecaptcha');

const app = express();

app.use(bodyParser.urlencoded({extended: false}));

// Outgoing APIs
const captcha = new grecaptcha('6LdMNpgUAAAAAE4mxNSM7_SCxUvelFBrfTK_oWyF');
const ghost = new admin({
    url: 'http://host.docker.internal:4100',
    key: '5c9138546a0ea000018cf3fd:57fc3ec4e8edeec4fd50caafed25c2adadf5661178562a39cff2c24efbbd31b2',
    version: 'v2'
});

// from top level path e.g. localhost:3000, this response will be sent
app.get('/', (request, response) => response.send('Hello World'));

app.get('/api', function (request, response) {
    response.send(

    );
});

const check_slug = function (question, tags, response) {
    let slug = Math.random().toString(16).substring(2, 2 + 6).toUpperCase(); // Random hex string of length 6

    get_contributors(question, tags, "", response);

    ghost.posts
        .read({slug: slug})
        .then(function () {
            return check_slug(question, tags, response);
        })
        .catch(function (err) {
            if (err.type === "ValidationError" || err.type === "NotFoundError") {
                // create_question(question, tags, slug, response);
                get_contributors(question, tags, slug, response);
            } else {
                console.log(err);
                response.statusCode = 401;
                response.send("Database indexing error");
            }
        });
};

const get_contributors = function (question, tags, slug, response) {
    ghost.pages
        .read({slug: 'active-contributors'})
        .then(function (data) {
            let contributors = data['authors'].map(x => x['email']);
            create_question(question, tags, slug, contributors, response)
        })
        .catch(function (err) {
            console.log(err);
            response.statusCode = 401;
            response.send("Contributor database indexing error");
        })
};

const create_question = function (question, tags, slug, contributors, response) {
    ghost.tags.browse().then(function (data) {
        let resolved_tags = [];

        if (tags && tags.length !== 0) {
            for (let tag of data) {
                if (tag.hasOwnProperty('slug') && tags.indexOf(tag['slug']) !== -1) {
                    resolved_tags.push(tag['name']);
                }
            }
        }
        console.log(resolved_tags);

        ghost.posts.add({
            title: '#' + slug + ": " + resolved_tags.join(", "),
            slug: slug,
            tags: resolved_tags,
            authors: contributors,
            mobiledoc: JSON.stringify(converter.toMobiledoc('<b>' + escape(question) + '</b> <hr>'))
        }).then(function (data) {
            response.statusCode = 200;
            response.send("Success");
        });
    }).catch(function (err) {
        console.log(err);
        response.statusCode = 401;
        response.send("Failed to get tags")
    });
};

app.post('/api/ask', function (request, response) {
    console.log(request.body);

    captcha.verify(request.body['g-recaptcha-response']).then((accepted) => {
        return check_slug(request.body.question, request.body.tags, response);
    }).catch((err) => {
        // Request failed.
        response.statusCode = 401;
        response.send("Recaptcha failed");

        console.log(err);
    });
});

// set the server to listen on port 3000
app.listen(3000, () => console.log('Listening on port 3000'));