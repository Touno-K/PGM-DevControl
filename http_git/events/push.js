const control 	= require("../../libs/control");
const config 		= require("../../app.config");
const auth    	= require("../../libs/auth");
const moment		= require("moment");
const chalk 		= require('chalk');
const path 			= require('path');

module.exports = function(push) {
  push.accept(function(){ 

    var repopath = config.path + '/' + push.repo;
    var revlist = [ 'rev-list', '--all', '--count' ];
    var logs = [ '--no-pager','log','--all','--source','--stat','--date=iso','--name-status' ];
		var data = { 
		  commit_index: 22,
		  repository: push.repo,
		  parents: null,
		  commit_id: push.commit,
		  commit_branch: push.branch,
		  commit_name: '',
		  commit_date: '',
		  comment_head: '',
		  comment_full: '',
		  commit_btn: "Go to commit id '" + push.commit.substr(0, 7) + "'",
		  commit_link: "//pgm.ns.co.th/"+push.repo+'/info/'+push.commit,
		  domain_name: 'pgm.ns.co.th',
		  limit_rows: 50,
		  files: [
		    { filename: 'dfgnwexwsd1.txt', status: '+', filepath: '/temp/test-mail/node_modules/async/support' },
		    { filename: 'dfgnwexwsd2.txt', status: '+', filepath: '/temp/test-mail/node_modules/async/tmp' },
		    { filename: 'dfgnwexwsd2.txt', status: '+', filepath: '/temp/test-mail/node_modules/async/tmp' },
		    { filename: 'dfgnwexwsd2.txt', status: '+', filepath: '/temp/test-mail/node_modules/async/tmp' }
		  ]
		}

		auth.username(push.headers).then(function(user){
			data.commit_name = user.fullname+'<'+user.email+'>';
    	console.log(user.username, "("+user.fullname+")", 'push /' + push.repo, ':', push.branch);
    	return control.cmd('git', revlist, repopath);
    }).then(function(index){
    	data.commit_index = index.replace(/[\n|\r]/g,'');

      var since = "-n 1 ";
			logs.push(since);
    	return control.cmd('git', logs, repopath);
    }).then(function(log){	
      var sinceFormat = "yyyy-MM-dd HH:mm:ss zzz";
    	var head = /Author:.(.*?>)\W+Date:.(.*)/.exec(log);
    	var note = /\n\n([\S|\s]+)\n\n\w/.exec(log)[1];
		  data.author_name = head[1],
		  data.commit_date = moment(head[2], sinceFormat).format('MMMM DD, YYYY HH:mm:ss'),
		  data.comment_head = note.trim().substr(0, 50);
		  data.comment_full = note.trim();
		  data.files = [];
		  var fileRegex = /[D|A|M][\t|\s]+.*/g;
		  log.match(fileRegex).forEach(function(file){
		  	file = /([D|A|M])[\t|\s]+(.*)/g.exec(file);
		  	var name = path.basename(file[2]);
		  	data.files.push({
		  		filename: name.substr(0, 30)+(name.length > 30 ? '...'+path.extname(file[2]) : ''), 
		  		status: file[1], 
		  		filepath: path.dirname('/'+file[2]) 
		  	});
		  });
    	return control.changeset(data, push);
    }).catch(function(ex){
    	console.log(chalk.red('event--push', ex));
    });

  });
}
