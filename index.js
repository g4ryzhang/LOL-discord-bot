// const fetch = require('cross-fetch');
// const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');

// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');

const COM_PREFIX = '!bot';
const GAME = 'League of Legends';
let INGAMEID = '';
const OPGG_LIVE_URL = 'https://na.op.gg/summoner/userName=';
let browser = null;

const crawlRanks = async (playerId, browser) => {
    const page = await browser.newPage();
    await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
    });
    await page.goto((OPGG_LIVE_URL + playerId), { waitUntil: 'domcontentloaded'});
    
    const spectateBtn = await page.$('.SpectateTabButton');
	await spectateBtn.click();
	await page.waitForTimeout(3000);

	await page.screenshot({ path: 'example.png' });

    const rankArr = await page.evaluate(() => {

        const parseFromTable = (table) => {
            const rankCells = table?.querySelectorAll('.TierRank');
            let rankArr = [];
            rankCells.forEach(c => rankArr.push(c.innerText));
			const champCells = table?.querySelectorAll('.ChampionImage>.Image.tip');
			champCells.forEach((c, idx) => {
				const champion = c.href?.split('/').slice(-2, -1)?.[0];
				rankArr[idx] = champion + ': ' + rankArr[idx];
			});
            return rankArr;
        }
        const teams = document
            ?.querySelector('.l-container')
            ?.querySelector('.summonerLayout-spectator')
            ?.querySelectorAll('table[class*="Table Team-"]');
        
        if (!teams.length) return [];

        const [blue, red] = teams;
        return parseFromTable(blue).concat(parseFromTable(red));
    });

    console.log(rankArr);

	return rankArr;
};

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_PRESENCES] });

// When the client is ready, run this code (only once)
client.once('ready', async () => {
	browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
	console.log('Ready!');
});

const getStatus = async () => {
	const statusArray = {};
	console.log(client.guilds);
	await client.guilds.array().forEach(async g => {
		const status = [];
		await g.members.array().forEach(m => {
			status.push(m.user.presense.status);
		});
		statusArray[g.id] = status;
	});
	console.log(statusArray);
	return statusArray;
};

// Reply to commands
client.on('messageCreate', async msg => {
	// console.log(msg);
	if (!msg.content.startsWith(COM_PREFIX)) return;

	const args = msg.content.slice(COM_PREFIX.length + 1).split(' ');
	const commandName = args[0];

	if (commandName === 'ping') {
		await msg.reply('Pong!');
	} else if (commandName === 'server') {
		await msg.reply(`Server name: ${msg.guild.name}.`);
	} else if (commandName === 'user') {
		await msg.reply(`Your tag: ${msg.author}.`);
	} else if (commandName === 'add') {
		INGAMEID = args.slice(1).join(' ') || '';
		await msg.reply(`Player ID set to: ${INGAMEID}`);
	} else if (commandName === 'live') {
		const member = INGAMEID || msg.mentions.members.first(); // || msg.member;
		// const targetActivity = member?.presence?.activities?.find(a => a.name === GAME && a.type === 'PLAYING');

		if (!member) {
			await msg.reply('Please add your LOL ID!');
			return;
		} 

		let ranks = await crawlRanks(member, browser);

		if (ranks && ranks.length) {
			const inGameMsg = `${member} is currently in a game!\n` +
							`----- Blue team rank tiers ----- \n` + 
							`${ranks.slice(0, 5).join('\r\n')}\n` +
							`----- Red team rank tiers -----\n` + 
							`${ranks.slice(5).join('\r\n')}`;
			await msg.reply(inGameMsg);
		} else {
			await msg.reply(`${member} is not in a live game!`);
		}
	}
});

// Login to Discord with your client's token
client.login(token);