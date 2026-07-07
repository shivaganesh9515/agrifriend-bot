# 🌱 AgriFriend Bot — Setup Guide

A WhatsApp bot that helps farmers with plant advice, disease detection, and farming tips.

---

## What You Need Before Starting

1. **A Hostinger VPS** (already purchased and running)
2. **A Gemini API Key** (free) — [Get it here](https://aistudio.google.com/apikey)
3. **A spare phone with WhatsApp** (not your personal number)

---

## Step 1: Open Terminal on Your VPS

Log into your Hostinger VPS using SSH. You'll see a black screen with a prompt like:

```
root@your-server:~$
```

---

## Step 2: Download the Bot Files

Copy and paste this command, then press **Enter**:

```bash
git clone https://github.com/shivaganesh9515/agrifriend-bot.git
cd agrifriend-bot
```

---

## Step 3: Run the Setup Script

Copy and paste this command, then press **Enter**:

```bash
chmod +x setup.sh && ./setup.sh
```

Wait for it to finish. It will install everything automatically.

---

## Step 4: Add Your Gemini API Key

Copy and paste this command to open the settings file:

```bash
nano .env
```

You'll see this on screen:

```
# Gemini API Key — get from https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here
```

**Delete** `your_gemini_api_key_here` and **paste your real Gemini API key**.

It should look like:

```
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxx
```

Now press these keys to save:
1. Press **Ctrl + O** (that's the letter O)
2. Press **Enter**
3. Press **Ctrl + X**

---

## Step 5: Start the Bot

Copy and paste this command:

```bash
pm2 restart agrifriend
```

---

## Step 6: Connect WhatsApp

Copy and paste this command to see the bot's screen:

```bash
pm2 logs agrifriend
```

You will see a **QR code** on the screen (a box made of dots).

Now take your **spare phone** and do this:

1. Open **WhatsApp** on the phone
2. Tap **Settings** (bottom right on iPhone, three dots on Android)
3. Tap **Linked Devices**
4. Tap **Link a Device**
5. Point the phone camera at the QR code on your screen

Wait a few seconds. You'll see "AgriFriend is connected!" in the terminal.

---

## Step 7: Test It!

Open WhatsApp on the spare phone and do this:

**Test in a group:**
1. Add the spare phone number to a farming group
2. Type: `agrifriend what fertilizer should I use for tomatoes?`
3. The bot should reply with farming advice!

**Test with a photo:**
1. Send a photo of a plant in the group
2. Tag the bot or say "agrifriend" before the photo
3. The bot should analyze the plant!

**Test in direct message:**
1. Send a direct message to the spare phone number
2. Ask any farming question
3. The bot should reply!

---

## That's It! 🎉

The bot is now running 24/7. It will:
- ✅ Answer farming questions
- ✅ Analyze plant photos
- ✅ Remember conversations
- ✅ Only respond to farming topics

---

## Need Help?

**Check if bot is running:**
```bash
pm2 status
```

**Stop the bot:**
```bash
pm2 stop agrifriend
```

**Start the bot again:**
```bash
pm2 start agrifriend
```

**See what the bot is doing:**
```bash
pm2 logs agrifriend
```

**Bot stopped after restarting server?** Run:
```bash
pm2 startup
pm2 save
```
This makes the bot start automatically when the server turns on.
