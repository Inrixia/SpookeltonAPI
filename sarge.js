const Discord = require("discord.js");
const Sarge = new Discord.Client();

Sarge.login('NDQxMDcyNzQ1NjI4MDQxMjI2.Dcq9SQ.dM3S_NI3khOmFhdhIp2AHhiWRY8');

Sarge.on('ready', () => {
	console.log(`Sarge Logged in as ${Sarge.user.tag}!`);
	Sarge.on('message', message => {
		if (message.author.id == 189586642011422721) {
			message.delete();
			Sarge.guilds.get('155507830076604416').channels.get(message.channel.id).send(message+'')
		}
	})
})