const express = require('express');
const router = express.Router();
const User = require('../models/User')
const Note = require('../models/Note')
const bcrypt = require('bcryptjs')
const passport = require('passport')
const { ensureAuthenticated } = require('../config/auth');
const axios = require("axios")
const cheerio = require("cheerio")

router.get('/',(req, res) => {
    res.render('home')
})

router.get('/login',(req, res) => {
    res.render('login')
})

router.get('/register',(req, res) => {
    res.render('register')
})

router.get('/profile', ensureAuthenticated, (req, res) => {
    res.render('profile', {
        user: req.user
    })
})

router.get('/ask',ensureAuthenticated, (req, res) => {
    res.render('ask')
})

router.get('/notes', ensureAuthenticated, (req, res) => {
    Note.find({'username': req.user.username }, function(err, notes) {
        res.render('notes', {
            notes
        })
    }).sort('-date')
})

router.get('/note/:id', ensureAuthenticated, (req, res) => {
    const { id } = req.params
    console.log(id)
    const axios = require("axios")
    const cheerio = require("cheerio")


    const textsToAvoid = ['Google', 'Images', 'News', 'Videos', 'Maps', 'Shopping', 'Books', 
                        'Search tools', 'Past hour', 'Past 24 hours', 'Past week', 'Past month', 
                        'Past year', 'Next >', 'Sign in', 'Settings', 'Privacy', 'Terms']

    const searchResults = []
    Note.findById(id, function(err, note) {
        axios.get(`https://www.google.com/search?q=${note.content}&tbm=vid`)
        .then((response) => {
            const $ = cheerio.load(response.data)
            links = $('a'); //jquery get all hyperlinks
            $(links).each(function(i, link){
                let linkText =  $(link).text()
                let linkUrl =  $(link).attr('href')
                if(!textsToAvoid.includes(linkText)) {
                if(linkUrl.startsWith('/url')) {
                    if(linkUrl.includes('www.youtube.com')) {
                        const updatedUrl = 'https://google.com' + linkUrl
                        if(linkText.includes('›')) {
                            linkText = linkText.split('›')[0]
                        }
                        const searchResult = {
                            text: linkText,
                            url: updatedUrl
                        }
                        searchResults.push(searchResult)
                    }
                }
                }
            })
            const updatedSearchResults = []
            for(let i=0; i < searchResults.length; i++) {
                if(searchResults[i].text == '') {}
                else {
                    updatedSearchResults.push(searchResults[i])
                }
            }
            res.render('results', {
                pageTitle: 'Recommended videos',
                searchQuery: note.content,
                searchResults: updatedSearchResults
            })
        })
        .catch(err => {
            console.log(err)
        })
    })
})

router.post('/delete-note', ensureAuthenticated, (req,res) => {
    const { noteId } = req.body
    Note.findByIdAndDelete(noteId, err => {
        if(err) {
            console.log(err)
        }
        res.redirect('/notes')
    })
})

router.post('/add-note', ensureAuthenticated, (req, res) => {
    const { noteContent } = req.body
    const newNote = new Note({
        username: req.user.username,
        content: noteContent
    })
    newNote.save()
        .then(note => {
            res.redirect('/notes')
        })
        .catch(err => console.log(err))
})

router.get('/recordings', ensureAuthenticated, (req, res) => {
    res.render('recordings')
})

router.post('/search', ensureAuthenticated, (req, res) => {
    const { searchQuery } = req.body
    const textsToAvoid = ['Google', 'Images', 'News', 'Videos', 'Maps', 'Shopping', 'Books', 
                      'Search tools', 'Past hour', 'Past 24 hours', 'Past week', 'Past month', 
                      'Past year', 'Next >', 'Sign in', 'Settings', 'Privacy', 'Terms']

    const searchResults = []
    axios.get(`https://www.google.com/search?q=${searchQuery}`)
    .then((response) => {
        const $ = cheerio.load(response.data)
        links = $('a'); //jquery get all hyperlinks
        $(links).each(function(i, link){
        let linkText =  $(link).text()
        let linkUrl =  $(link).attr('href')
        if(!textsToAvoid.includes(linkText)) {
            if(linkUrl.startsWith('/url')) {
            const updatedUrl = 'https://google.com' + linkUrl
            if(linkText.includes('›')) {
                linkText = linkText.split('›')[0]
            }
            const searchResult = {
                text: linkText,
                url: updatedUrl
            }
            searchResults.push(searchResult)
            }
        }
        });
        const updatedSearchResults = []
        for(let i=0; i < searchResults.length; i++) {
        if(searchResults[i].text == '') {}
        else {
            updatedSearchResults.push(searchResults[i])
        }
        }
        console.log(updatedSearchResults)
        res.render('results', {
            pageTitle: 'Search results',
            searchQuery: searchQuery,
            searchResults: updatedSearchResults
        })
    })
    .catch(err => {
        console.log(err)
        res.redirect('/ask')
    })
})

router.post('/register',(req, res) => {
    const { username, password, name } = req.body;
    let errors = [];

    if(!username || !password || !name) {
        errors.push({ msg: 'Please fill in all fields' });
    }

    if(password.length < 6) {
        errors.push({ msg: 'Password should be atleast 6 characters' })
    }

    if(errors.length > 0) {
        res.render('register', {
            errors,
            username,
            password,
            name,
        })
    } else {
        User.findOne({ username: username })
            .then(user => {
                if(user) {
                    errors.push({ msg: 'username is taken' })
                    res.render('register', {
                        errors,
                        username,
                        password,
                        name,
                    })
                } else {
                    const newUser = new User({
                        username,
                        password,
                        name
                    })
                    
                    bcrypt.genSalt(10, (err, salt) => bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if(err) throw err;
                    
                        newUser.password = hash;
                    
                        newUser.save()
                            .then(user => {
                                req.flash('success_msg', 'You can now login')
                                res.redirect('/login')
                            })
                            .catch(err => console.log(err))
                    }))
                }
            })
    }

})

router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/ask',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res , next);
})

router.get('/logout', (req, res, next) => {
    req.logout();
    req.flash('success_msg', 'You are now logged out');
    res.redirect('/login')
})

module.exports = router;