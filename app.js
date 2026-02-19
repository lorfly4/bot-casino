const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Events
} = require('discord.js');

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    getVoiceConnection
} = require('@discordjs/voice');

const playdl = require('play-dl');
const db = require('./db');
const BlackjackGame = require('./blackjack');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const player = new Player(client);

(async () => {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Extractor loaded");
})();

const activeGames = new Map();
const musicQueues = new Map();

client.once(Events.ClientReady, () => {
    console.log(`✅ Bot siap! Login sebagai ${client.user.tag}`);
});

/* =========================================================
   MUSIC SYSTEM (YOUTUBE ONLY)
========================================================= */



function getOrCreateQueue(guildId, textChannel, voiceChannel) {
    let queue = musicQueues.get(guildId);

    if (!queue) {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        queue = {
            songs: [],
            player,
            textChannel,
            voiceChannel,
            connection
        };

        player.on(AudioPlayerStatus.Idle, () => {
            queue.songs.shift();
            playNext(guildId);
        });

        player.on('error', (error) => {
            console.log(`[Player Error] ${error.message}`);
            queue.songs.shift();
            playNext(guildId);
        });

        musicQueues.set(guildId, queue);
    }

    return queue;
}

async function playNext(guildId) {
    const queue = musicQueues.get(guildId);

    if (!queue || queue.songs.length === 0) {
        const connection = getVoiceConnection(guildId);
        if (connection) connection.destroy();
        musicQueues.delete(guildId);
        return;
    }

    const song = queue.songs[0];

    try {

        if (!ytdl.validateURL(song.url)) {
            throw new Error("URL tidak valid untuk YouTube");
        }

        const stream = ytdl(song.url, {
            filter: "audioonly",
            quality: "highestaudio",
            highWaterMark: 1 << 25
        });

const resource = createAudioResource(stream, {
    inlineVolume: true
});

        queue.player.play(resource);
        queue.textChannel.send(`🎶 | Sekarang memutar: **${song.title}**`);

    } catch (error) {
        console.log("[Stream Error]", error.message);
        queue.textChannel.send("❌ | Gagal memutar lagu.");
        queue.songs.shift();
        playNext(guildId);
    }
}


/* =========================================================
   MESSAGE HANDLER
========================================================= */

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    /* ========================
       HELP COMMAND
    ======================== */
    if (command === 'help') {
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || db.getUser(message.author.id).isAdmin;

        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Casino & Music - Panduan Perintah')
            .setDescription('Berikut adalah daftar perintah yang tersedia:')
            .addFields(
                { name: '🪙 Casino', value: '`!coins` / `!claim` - Klaim koin harian gratis\n`!balance` / `!saldo` - Cek saldo koin kamu\n`!play <jumlah>` - Bermain Blackjack dengan taruhan' },
                { name: '🎵 Music', value: '`!play <judul/url>` - Memutar musik dari Spotify/YouTube\n`!skip` - Melewati lagu saat ini\n`!stop` - Menghentikan musik dan menghapus antrean\n`!queue` - Melihat daftar antrean lagu' }
            )
            .setColor('Gold')
            .setFooter({ text: 'Gunakan awalan ! untuk setiap perintah' })
            .setTimestamp();

        if (isAdmin) {
            helpEmbed.addFields({ name: '🛠️ Admin', value: '`!addcoins @user <jumlah>` - Menambah koin ke pengguna tertentu' });
        }

        return message.reply({ embeds: [helpEmbed] });
    }

    /* ========================
       ADMIN: !addcoins
    ======================== */
    if (command === 'addcoins') {
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || db.getUser(message.author.id).isAdmin;
        if (!isAdmin) return message.reply('Hanya admin yang bisa menambah saldo!');

        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount)) {
            return message.reply('Gunakan format: `!addcoins @user <jumlah>`');
        }

        const newBalance = db.updateBalance(target.id, amount);
        return message.reply(`Berhasil menambahkan ${amount} koin ke ${target.username}. Saldo sekarang: ${newBalance} koin.`);
    }

    /* ========================
       MUSIC: !play <judul/url>
    ======================== */
    if (command === 'play' && args.length > 0 && isNaN(parseInt(args[0]))) {

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('Kamu harus berada di voice channel!');

    const query = args.join(' ');

    try {

        await player.play(voiceChannel, query, {
            nodeOptions: {
                metadata: message.channel
            }
        });

        return message.reply(`🎵 | Memutar: **${query}**`);

    } catch (error) {
        console.log(error);
        return message.reply("❌ | Gagal memutar lagu.");
    }
}

player.events.on('playerStart', (queue, track) => {
    queue.metadata.send(`🎶 | Sekarang memutar: **${track.title}**`);
});

    /* ========================
       SKIP
    ======================== */
    if (command === 'skip') {
    const queue = player.nodes.get(message.guild.id);

    if (!queue || !queue.currentTrack) {
        return message.reply('Tidak ada lagu yang sedang diputar!');
    }

    queue.node.skip();
    return message.reply('⏭️ | Lagu dilewati!');
}


    /* ========================
       STOP
    ======================== */
    if (command === 'stop') {
    const queue = player.nodes.get(message.guild.id);

    if (!queue) {
        return message.reply('Tidak ada musik yang sedang diputar!');
    }

    queue.delete(); // ini otomatis stop + leave

    return message.reply('🛑 | Musik dihentikan!');
}


    /* ========================
       QUEUE
    ======================== */
    if (command === 'queue') {
    const queue = player.nodes.get(message.guild.id);

    if (!queue || !queue.currentTrack) {
        return message.reply('Antrean saat ini kosong!');
    }

    const tracks = queue.tracks.toArray();

    let description = `🎶 **Sedang Memutar:**\n**${queue.currentTrack.title}**\n\n`;

    if (tracks.length > 0) {
        description += `📜 **Antrean Berikutnya:**\n`;

        tracks.slice(0, 10).forEach((track, i) => {
            description += `${i + 1}. **${track.title}**\n`;
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('Music Queue')
        .setDescription(description)
        .setColor('Blue')
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

    /* ========================
       COINS / CLAIM
    ======================== */
    if (command === 'coins' || command === 'claim') {

        const user = db.getUser(message.author.id);
        const now = new Date();
        const lastClaimed = user.lastClaimed ? new Date(user.lastClaimed) : null;

        if (lastClaimed && now - lastClaimed < 86400000) {
            const nextClaim = new Date(lastClaimed.getTime() + 86400000);
            const diff = nextClaim - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            return message.reply(`Kamu sudah claim hari ini! Tunggu ${hours} jam ${minutes} menit lagi.`);
        }

        const randomCoins = Math.floor(Math.random() * 1001);
        db.updateBalance(message.author.id, randomCoins);
        db.updateLastClaimed(message.author.id);

        return message.reply(`Selamat! Kamu mendapatkan **${randomCoins}** koin gratis hari ini 🪙`);
    }

    /* ========================
       BALANCE
    ======================== */
    if (command === 'balance' || command === 'saldo') {
        const user = db.getUser(message.author.id);
        return message.reply(`Saldo kamu: ${user.balance} koin.`);
    }

    /* ========================
       BLACKJACK (TIDAK DIUBAH)
    ======================== */
    /* ========================
       BLACKJACK: !play <jumlah>
    ======================== */
    if (command === 'play' && args.length > 0 && !isNaN(parseInt(args[0]))) {
        const bet = parseInt(args[0]);
        if (bet <= 0) return message.reply('Masukkan jumlah taruhan yang valid!');
        await startBlackjack(message, bet);
    }

    /* ========================
       BLACKJACK: !allin
    ======================== */
    if (command === 'allin') {
        const user = db.getUser(message.author.id);
        const bet = user.balance;

        if (bet <= 0) return message.reply('Saldo kamu habis! Claim dulu pakai !claim');
        
        await startBlackjack(message, bet);
    }

    /* ========================
       GEMINI: !ask <pertanyaan>
    ======================== */
    if (command === 'ask') {
        const question = args.join(' ');
        if (!question) return message.reply('Mau tanya apa?');

        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Menggunakan model Gemini 3 Flash Preview sesuai permintaan
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

            await message.channel.sendTyping();

            const result = await model.generateContent(question);
            const response = await result.response;
            const text = response.text();

            if (text.length > 2000) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(text);
            }
        } catch (error) {
            console.error(error);
            return message.reply('Maaf, saya sedang pusing (Error Gemini API). Pastikan API Key benar!');
        }
    }
});

// Format hand function
function formatHand(hand) {
    return hand.map(c => `[${c.value}${c.suit}]`).join(' ');
}

function formatHandEmoji(hand) {
    // Map of suit characters/symbols to colored emojis
    const suitMap = {
        'H': '♥️', '♥': '♥️', // Hearts
        'D': '♦️', '♦': '♦️', // Diamonds
        'S': '♠️', '♠': '♠️', // Spades
        'C': '♣️', '♣': '♣️'  // Clubs
    };

    return hand.map(c => {
        const suit = suitMap[c.suit] || c.suit;
        return `${c.value} ${suit}`;
    }).join(' - ');
}

async function startBlackjack(message, bet) {
    if (activeGames.has(message.author.id)) {
        return message.reply('Kamu masih punya permainan yang sedang berjalan!');
    }

    const user = db.getUser(message.author.id);
    if (user.balance < bet) {
        return message.reply(`Saldo tidak cukup! Saldo kamu: ${user.balance}`);
    }

    db.updateBalance(message.author.id, -bet);

    const game = new BlackjackGame(message.author.id, bet);
    activeGames.set(message.author.id, game);

    const state = game.getState();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('hit')
                .setLabel('Hit')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stand')
                .setLabel('Stand')
                .setStyle(ButtonStyle.Secondary)
        );

    const playerScoreStr = state.playerScore === 21 ? 'Blackjack' : state.playerScore;

    const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(`Taruhan: ${bet} koin`)
        .addFields(
            { name: 'Your Hand', value: `${formatHandEmoji(state.playerHand)}\nValue: ${playerScoreStr}`, inline: true },
            { name: 'Dealer Hand', value: `${formatHandEmoji([state.dealerHand[0]])} - ?\nValue: ?`, inline: true }
        )
        .setColor('Blue');

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on('collect', async i => {
        if (i.user.id !== message.author.id) {
            return i.reply({ content: 'Ini bukan permainanmu!', ephemeral: true });
        }

        if (i.customId === 'hit') {
            await i.deferUpdate();
            const newState = game.hit();
            const newScoreStr = newState.playerScore > 21 ? `${newState.playerScore} (Bust)` : (newState.playerScore === 21 ? 'Blackjack' : newState.playerScore);

            if (newState.status === 'loss') {
                activeGames.delete(message.author.id);

                const lossEmbed = new EmbedBuilder()
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .setDescription(`**You lost ${bet} coins**\nResult: You busted`)
                    .addFields(
                        { name: 'Your Hand', value: `${formatHandEmoji(newState.playerHand)}\nValue: ${newScoreStr}`, inline: true },
                        { name: 'Dealer Hand', value: `${formatHandEmoji(newState.dealerHand)}\nValue: ${newState.dealerScore}`, inline: true }
                    )
                    .setColor('Red');

                return i.editReply({
                    embeds: [lossEmbed],
                    components: []
                });
            }

            const hitEmbed = new EmbedBuilder()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Taruhan: ${bet} koin`)
                .addFields(
                    { name: 'Your Hand', value: `${formatHandEmoji(newState.playerHand)}\nValue: ${newScoreStr}`, inline: true },
                    { name: 'Dealer Hand', value: `${formatHandEmoji([newState.dealerHand[0]])} - ?\nValue: ?`, inline: true }
                )
                .setColor('Blue');

            return i.editReply({
                embeds: [hitEmbed],
                components: [row]
            });
        }

        if (i.customId === 'stand') {
            await i.deferUpdate();
            const finalState = game.stand();
            activeGames.delete(message.author.id);

            let resultText = '';
            let color = 'Yellow';
            let finalResult = '';

            if (finalState.status === 'win') {
                db.updateBalance(message.author.id, finalState.bet * 2);
                resultText = `**You won ${finalState.bet} coins**`;
                finalResult = 'You Won';
                color = 'Green';
            } else if (finalState.status === 'loss') {
                resultText = `**You lost ${finalState.bet} coins**`;
                finalResult = 'You Lost';
                color = 'Red';
            } else {
                db.updateBalance(message.author.id, finalState.bet);
                resultText = `**You broke even**`;
                finalResult = 'Push, money back';
            }

            const playerFinalScore = finalState.playerScore === 21 ? 'Blackjack' : finalState.playerScore;
            const dealerFinalScore = finalState.dealerScore === 21 ? 'Blackjack' : finalState.dealerScore;

            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(resultText)
                .addFields(
                    { name: 'Your Hand', value: `${formatHandEmoji(finalState.playerHand)}\nValue: ${playerFinalScore}`, inline: true },
                    { name: 'Dealer Hand', value: `${formatHandEmoji(finalState.dealerHand)}\nValue: ${dealerFinalScore}`, inline: true }
                )
                .setFooter({ text: `Result: ${finalResult}` })
                .setColor(color);

            return i.editReply({
                embeds: [resultEmbed],
                components: []
            });
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            if (activeGames.get(message.author.id) === game) {
                activeGames.delete(message.author.id);
            }
            
            response.edit({ components: [] }).catch(() => {});
        }
    });
}

client.login(process.env.DISCORD_TOKEN);
