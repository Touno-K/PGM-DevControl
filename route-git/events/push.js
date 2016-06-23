"use strict";
const config  = require("$custom/config");
const control = require("$custom/touno-git").control;
const auth 		= require("$custom/touno-git").auth;
const Q 				= require('q');
const mongo 		= require("$custom/schema");
const db 				= require("$custom/mysql").connect();
const moment		= require("moment");
const chalk 		= require('chalk');
const path 			= require('path');

module.exports = function(push) {
  push.accept(function(){
  	var infoTime = moment().format(' HH:mm:ss');
    var dirRepository = config.source+'/'+push.repo;
    var sinceFormat = 'ddd, D MMM YYYY HH:mm:ss ZZ';
    var access = {};
    
    var getTotalList = [ 'rev-list', '--all', '--count' ];
    var RegexCommit = 0;

		auth.username(push.headers).then(function(user){
			access = user;
  		console.log(chalk.green(infoTime), "logs", access.fullname, "push",chalk.green(push.repo, ':', push.branch));
			return db.query('SELECT repository_id FROM repositories WHERE dir_name = :name', { name: push.repo })
		}).then(function(repo){
			access.repository_id = repo[0].repository_id;
	    var def = Q.defer();
			var findCommits = mongo.Commit.findOne({ 'repository_id': access.repository_id }).sort({since : -1});
			findCommits.exec(function(err, result){
		    if (err) { def.reject(); }
		    def.resolve(result);
			});
	    return def.promise;
		}).then(function(commit){

	  	if(push.commit === '0000000000000000000000000000000000000000') {
    		let regexLogs = [];
    		regexLogs.push((function(){
  				let def = Q.defer();

					let log = new mongo.Commit({
						commit_id: push.commit,
	    			repository_id: access.repository_id,
	    			author: access.fullname, 
	    			email: access.email, 
	    			subject: `removed your branch is '${push.branch}'`, 
	    			comment: null, 
	    			logs: false,
	    			since: new Date(),
	    		});
					log.save(function (err, log) { if (err) def.reject(err); else def.resolve(log);	}); 
    			return def.promise;
    		})());

    		RegexCommit = regexLogs.length;
	    	return Q.all(regexLogs);
	  	} else {
    		let regexLogs = [];
	  		var logFormat = [ '--no-pager', 'log', '--all', `--format=[]%ci%n[]%H%n[]%P%n[]%cn#%ae%n'%B'` ]; 
	  		if(commit) {
	  			let since_date = moment(commit.since).add(1, 'seconds').format(sinceFormat);
	  			logFormat.push(`--since="${since_date}"`);
				}
				// console.log(chalk.yellow('git', logFormat.join(' ')));
	    	return control.cmd('git', logFormat, dirRepository).then(function(logs){
		  		let cmdlogs = logs.match(/\[\][\W\w]*?'[\W\w]*?'/ig);
		    	(cmdlogs || []).forEach(function(item){
		    		let commit_log = /\[\](.+?)\n\[\]([a-f0-9]{40})\n\[\]([a-f0-9 ]{81}|[a-f0-9]{40}|)\n\[\](.+)\n'([\W\w]+?)'/g.exec(item);
	  				let author = commit_log[4].trim().split(/#/), comment = commit_log[5].trim().split(/\n\n/);

		    		// commit logs
		    		regexLogs.push((function(){
		    			let def = Q.defer();
							let log = new mongo.Commit({
			    			commit_id: commit_log[2],
			    			repository_id: access.repository_id,
			    			author: author[0],
			    			email: author[1], 
			    			since: new Date(commit_log[1]),
			    			parent_id: commit_log[3], 
			    			subject: comment[0], 
			    			logs: true,
			    			comment: comment[1] || null, 
			    		});
							log.save(function (err, log) { if (err) def.reject(err); else def.resolve(log);	}); 
			    		return def.promise;
		    		})());

    				RegexCommit = regexLogs.length;
	    			return Q.all(regexLogs);
	    		});
	    	});
	  	}
    }).then(function(){
	    if(push.commit !== '0000000000000000000000000000000000000000') {
	    	let logFiles = ['diff-tree', ' --no-commit-id', '--name-status', push.commit];
	    	control.cmd('git', logFiles, dirRepository).then(function(files){
  				let def = Q.defer(), added = false;

		    	(files.match(/.*\n/ig) || []).forEach(function(item){
		    		let stats = /([AMD])\W+(.*)\n/ig.exec(item) || [];
		    		if(stats[1] === 'A') {
		    			added = true;
		    			break;
		    		}
		    	});
					def.resolve(added);
    			return def.promise;
	    	}).then(function(added){
	    		console.log('added file', added);
	    		if(added) {

	    		}
	    	});
	    }

  		console.log(chalk.green(infoTime), `logs ${RegexCommit} items saved.`, access.fullname, "push",chalk.green(push.repo, ':', push.branch));
    }).catch(function(ex){
    	console.log(chalk.red(infoTime), chalk.red('catch--push'), ex);
    });

  });
}