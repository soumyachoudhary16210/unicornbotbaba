#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
🦄 UNICORN GOODS — Official Telegram Bot
Username: @Unicorngoods_bot
Features:
  - Force-Subscribe Channel Verification (@its_vivek_x_sakku)
  - Full Parity with Web Storefront & Realtime Database
  - Instant Universal Auto-Search on ANY typed text
  - Material Request & Bug Report Submissions with Live Status Tracking
  - Saved Goods / Bookmarks
  - Automated Notifications on Admin Replies & Updates
  - Direct Cloud Downloads & Community Explorer
==============================================================================
"""

import os
import sys
import html
import time
import logging
import asyncio
from typing import Optional, Dict, Any, List

import httpx
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
    constants,
    BotCommand,
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    ContextTypes,
    filters,
)

# -----------------------------------------------------------------------------
# 1. LOGGING CONFIGURATION
# -----------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s - [%(levelname)s] - %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("UnicornGoodsBot")

# -----------------------------------------------------------------------------
# 2. BOT & FIREBASE CREDENTIALS
# -----------------------------------------------------------------------------
BOT_TOKEN = os.getenv("BOT_TOKEN", "8910019479:AAHYV5pFGGXjpbjqv8ZdUqKslZDh7CBKqGk")
REQUIRED_CHANNEL = os.getenv("REQUIRED_CHANNEL", "@its_vivek_x_sakku")
REQUIRED_CHANNEL_URL = os.getenv("REQUIRED_CHANNEL_URL", "https://t.me/its_vivek_x_sakku")
FIREBASE_RTDB_URL = os.getenv(
    "FIREBASE_RTDB_URL", "https://unicorn-goods-default-rtdb.firebaseio.com"
).rstrip("/")
# In-memory session tracking for active users & notified requests
ADMIN_USER_IDS = set()
NOTIFIED_REQUEST_STATUS: Dict[str, str] = {}
NOTIFIED_REPORT_STATUS: Dict[str, str] = {}
LAST_SEEN_NOTIF_TS = int(time.time() * 1000)

# Conversation States
(
    REQ_NAME,
    REQ_CATEGORY,
    REQ_DETAILS,
    REP_REASON,
    REP_DETAILS,
) = range(5)

# -----------------------------------------------------------------------------
# 3. FIREBASE REALTIME DATABASE CLIENT (ASYNC REST API)
# -----------------------------------------------------------------------------
class FirebaseRTDB:
    @staticmethod
    async def get(path: str) -> Optional[Any]:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.error(f"Firebase GET error ({path}): {e}")
        return None

    @staticmethod
    async def post(path: str, data: Dict[str, Any]) -> Optional[str]:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=data)
                if resp.status_code == 200:
                    res = resp.json()
                    return res.get("name") if res else None
        except Exception as e:
            logger.error(f"Firebase POST error ({path}): {e}")
        return None

    @staticmethod
    async def patch(path: str, data: Dict[str, Any]) -> bool:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.patch(url, json=data)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"Firebase PATCH error ({path}): {e}")
        return False

    @staticmethod
    async def put(path: str, data: Any) -> bool:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.put(url, json=data)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"Firebase PUT error ({path}): {e}")
        return False

    @staticmethod
    async def get_products() -> List[Dict[str, Any]]:
        raw = await FirebaseRTDB.get("products")
        if not raw or not isinstance(raw, dict):
            return []
        products = []
        for pid, pdata in raw.items():
            if isinstance(pdata, dict) and pdata.get("status") == "published":
                pdata["id"] = pid
                products.append(pdata)
        products.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return products

    @staticmethod
    async def get_all_products_raw() -> List[Dict[str, Any]]:
        raw = await FirebaseRTDB.get("products")
        if not raw or not isinstance(raw, dict):
            return []
        products = []
        for pid, pdata in raw.items():
            if isinstance(pdata, dict):
                pdata["id"] = pid
                products.append(pdata)
        products.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return products

    @staticmethod
    async def register_bot_user(user) -> None:
        if not user:
            return
        user_data = {
            "id": user.id,
            "username": user.username or "",
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "lastActive": int(time.time() * 1000),
        }
        await FirebaseRTDB.put(f"bot_users/{user.id}", user_data)

    @staticmethod
    async def get_all_bot_users() -> List[int]:
        raw = await FirebaseRTDB.get("bot_users")
        if not raw or not isinstance(raw, dict):
            return []
        return [int(uid) for uid in raw.keys() if uid.isdigit()]

# -----------------------------------------------------------------------------
# 4. FORCE-SUBSCRIBE VERIFICATION (FSUB)
# -----------------------------------------------------------------------------
async def check_channel_membership(user_id: int, bot) -> bool:
    """Verifies whether the user is a member of @its_vivek_x_sakku."""
    try:
        member = await bot.get_chat_member(chat_id=REQUIRED_CHANNEL, user_id=user_id)
        if member.status in [
            constants.ChatMemberStatus.CREATOR,
            constants.ChatMemberStatus.ADMINISTRATOR,
            constants.ChatMemberStatus.MEMBER,
            constants.ChatMemberStatus.RESTRICTED,
        ]:
            return True
        return False
    except Exception as e:
        logger.warning(
            f"Membership check warning for user {user_id} in {REQUIRED_CHANNEL}: {e}. "
            "Ensure the bot is added as an administrator to the channel."
        )
        # If bot is not yet added to channel as admin, allow fallback so bot doesn't freeze
        return True

def get_fsub_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton("📢 Join Official Channel ↗", url=REQUIRED_CHANNEL_URL)],
        [InlineKeyboardButton("✅ I Have Joined / Verify", callback_data="verify_membership")],
    ]
    return InlineKeyboardMarkup(buttons)

async def send_fsub_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🦄 <b>Welcome to UNICORN GOODS!</b>\n"
        "<i>Curated Free Digital Library & Study Hub</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚠️ <b>Channel Membership Required</b>\n\n"
        "To prevent spam and keep all materials, notes, APKs, and direct high-speed cloud "
        "downloads 100% free, you must be a member of our official channel:\n\n"
        f"📢 <b>Channel:</b> {REQUIRED_CHANNEL}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "👉 <i>Click the button below to join, then press <b>Verify</b> to unlock the bot!</i>"
    )
    if update.callback_query:
        await update.callback_query.answer("⚠️ Please join our channel first!", show_alert=True)
        try:
            await update.callback_query.edit_message_text(
                text, parse_mode=constants.ParseMode.HTML, reply_markup=get_fsub_keyboard()
            )
        except Exception:
            pass
    elif update.effective_message:
        await update.effective_message.reply_text(
            text, parse_mode=constants.ParseMode.HTML, reply_markup=get_fsub_keyboard()
        )

# -----------------------------------------------------------------------------
# 5. UI COMPONENTS & KEYBOARDS
# -----------------------------------------------------------------------------
def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("📚 Study Materials", callback_data="cat:Study Material"),
            InlineKeyboardButton("📝 Notes & PDFs", callback_data="cat:Notes"),
        ],
        [
            InlineKeyboardButton("📱 APKs & Android", callback_data="cat:APK"),
            InlineKeyboardButton("💻 Software & PC", callback_data="cat:Software"),
        ],
        [
            InlineKeyboardButton("🛠️ Tools & Utilities", callback_data="cat:Tools"),
            InlineKeyboardButton("🌐 All Goods", callback_data="cat:All"),
        ],
        [
            InlineKeyboardButton("🔍 Search Material", callback_data="nav:search"),
            InlineKeyboardButton("➕ Request Item", callback_data="nav:request"),
        ],
        [
            InlineKeyboardButton("📋 My Requests & Activity", callback_data="nav:activity"),
            InlineKeyboardButton("⭐ Saved Goods", callback_data="nav:saved"),
        ],
        [
            InlineKeyboardButton("ℹ️ About UNICORN", callback_data="nav:about"),
            InlineKeyboardButton("📢 Announcements", callback_data="nav:popup"),
        ],
        [
            InlineKeyboardButton("🌐 Open Web Storefront ↗", url="https://unicorngoods.vercel.app"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)

def get_product_card_keyboard(product: Dict[str, Any], user_id: int) -> InlineKeyboardMarkup:
    pid = product.get("id", "")
    file_url = product.get("fileUrl", "#")
    buttons = [
        [InlineKeyboardButton("📥 GET NOW (Direct Link) ↗", url=file_url)],
        [
            InlineKeyboardButton("⭐ Save", callback_data=f"save:{pid}"),
            InlineKeyboardButton("⚠️ Report Issue", callback_data=f"report_item:{pid}"),
        ],
        [InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")],
    ]
    return InlineKeyboardMarkup(buttons)

def get_category_pagination_keyboard(
    category: str, page: int, total_pages: int, count: int
) -> InlineKeyboardMarkup:
    row = []
    if page > 0:
        row.append(InlineKeyboardButton("◀️ Previous", callback_data=f"page:{category}:{page - 1}"))
    row.append(InlineKeyboardButton(f"📄 {page + 1}/{max(1, total_pages)} ({count})", callback_data="noop"))
    if page < total_pages - 1:
        row.append(InlineKeyboardButton("Next ▶️", callback_data=f"page:{category}:{page + 1}"))

    buttons = [row] if row else []
    buttons.append([InlineKeyboardButton("🔙 Back to Categories", callback_data="nav:categories")])
    buttons.append([InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")])
    return InlineKeyboardMarkup(buttons)

# -----------------------------------------------------------------------------
# 6. COMMAND HANDLERS
# -----------------------------------------------------------------------------
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    await FirebaseRTDB.register_bot_user(user)

    # Force-Subscribe check
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    # Check maintenance mode
    maint = await FirebaseRTDB.get("settings/maintenance")
    if maint and maint.get("enabled") is True and user.id not in ADMIN_USER_IDS:
        m_title = maint.get("title", "Under Maintenance")
        m_msg = maint.get("message", "We are upgrading UNICORN GOODS. Please check back shortly!")
        await update.effective_message.reply_text(
            f"🚧 <b>{html.escape(m_title)}</b>\n\n{html.escape(m_msg)}",
            parse_mode=constants.ParseMode.HTML,
        )
        return

    welcome_text = (
        f"👋 <b>Hi, {html.escape(user.first_name or 'Friend')}!</b>\n\n"
        "🦄 Welcome to <b>UNICORN GOODS</b> — your curated free digital download library & study hub.\n\n"
        "⚡ <b>What you can do here:</b>\n"
        "• <b>Search anything:</b> Just type ANY book, note, APK or software name in chat!\n"
        "• <b>Browse Categories:</b> High-speed direct downloads with 0 ads.\n"
        "• <b>Request Materials:</b> Submit missing requests and get live admin replies.\n"
        "• <b>Report Broken Links:</b> Report broken links to get them fixed promptly.\n\n"
        "👇 <i>Choose an option below to get started:</i>"
    )

    await update.effective_message.reply_text(
        welcome_text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=get_main_menu_keyboard(),
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    help_text = (
        "💡 <b>UNICORN GOODS Bot Guide:</b>\n\n"
        "🔍 <b>Instant Search:</b> Just type any topic (e.g. <code>Python</code>, <code>NEET</code>, <code>Capcut</code>) directly in chat!\n"
        "📚 <b>/menu:</b> Open the main category explorer.\n"
        "➕ <b>/request:</b> Request any study material or software not currently in the library.\n"
        "⚠️ <b>/report:</b> Report a broken download link or issue.\n"
        "📋 <b>/activity:</b> Track your submitted requests and view admin replies.\n"
        "⭐ <b>/saved:</b> View your bookmarked materials.\n"
        "ℹ️ <b>/about:</b> Community guidelines, mission & contact links.\n"
        "📢 <b>/announcement:</b> View latest platform announcements."
    )
    await update.effective_message.reply_text(help_text, parse_mode=constants.ParseMode.HTML)

# -----------------------------------------------------------------------------
# 7. CATEGORY BROWSER & PAGINATION
# -----------------------------------------------------------------------------
ITEMS_PER_PAGE = 4

async def render_category_page(
    query, category: str, page: int, user_id: int
) -> None:
    products = await FirebaseRTDB.get_products()
    if category != "All":
        filtered = [p for p in products if p.get("category") == category]
    else:
        filtered = products

    total_count = len(filtered)
    total_pages = (total_count + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE

    if total_count == 0:
        text = (
            f"📂 <b>Category: {html.escape(category)}</b>\n\n"
            "<i>No materials found in this category yet.</i>\n\n"
            "💡 You can request our team to add it using the <b>Request Item</b> button!"
        )
        keyboard = [
            [InlineKeyboardButton("➕ Request an Item", callback_data="nav:request")],
            [InlineKeyboardButton("🔙 Back to Categories", callback_data="nav:categories")],
        ]
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    page = max(0, min(page, total_pages - 1))
    start_idx = page * ITEMS_PER_PAGE
    end_idx = min(start_idx + ITEMS_PER_PAGE, total_count)
    page_items = filtered[start_idx:end_idx]

    text = (
        f"📂 <b>{html.escape(category.upper())}</b> ({total_count} total items)\n"
        f"<i>Page {page + 1} of {total_pages}</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )

    item_buttons = []
    for idx, p in enumerate(page_items, start=start_idx + 1):
        title = p.get("title", "Untitled")
        cat = p.get("category", "Other")
        desc = (p.get("desc") or "").strip()
        if len(desc) > 80:
            desc = desc[:77] + "..."
        desc_line = f"   <i>{html.escape(desc)}</i>\n" if desc else ""
        text += f"<b>{idx}. {html.escape(title)}</b> [{html.escape(cat)}]\n{desc_line}\n"
        item_buttons.append([
            InlineKeyboardButton(f"📄 View #{idx}: {title[:25]}", callback_data=f"view_prod:{p['id']}")
        ])

    nav_keyboard = get_category_pagination_keyboard(category, page, total_pages, total_count)
    combined_buttons = item_buttons + nav_keyboard.inline_keyboard

    await query.edit_message_text(
        text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(combined_buttons),
    )

async def show_product_detail(update: Update, product_id: str) -> None:
    query = update.callback_query
    products = await FirebaseRTDB.get_all_products_raw()
    product = next((p for p in products if p.get("id") == product_id), None)

    if not product:
        if query:
            await query.answer("Material not found or deleted.", show_alert=True)
        return

    title = product.get("title", "Untitled")
    category = product.get("category", "General")
    desc = product.get("desc", "No description provided.")
    img_url = product.get("imgUrl", "").strip()

    caption = (
        f"📦 <b>{html.escape(title)}</b>\n"
        f"🏷️ <b>Category:</b> <code>{html.escape(category)}</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📝 <b>Description:</b>\n{html.escape(desc)}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚡ <i>Verified Direct Cloud Download</i>"
    )

    keyboard = get_product_card_keyboard(product, query.from_user.id if query else 0)

    # Try sending photo if available
    if img_url and img_url.startswith("http"):
        try:
            if query:
                await query.message.reply_photo(
                    photo=img_url,
                    caption=caption,
                    parse_mode=constants.ParseMode.HTML,
                    reply_markup=keyboard,
                )
                await query.answer()
                return
        except Exception as e:
            logger.debug(f"Photo send fallback: {e}")

    # Text fallback
    if query:
        await query.edit_message_text(
            caption,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
    elif update.effective_message:
        await update.effective_message.reply_text(
            caption,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )

# -----------------------------------------------------------------------------
# 8. SMART UNIVERSAL AUTO-SEARCH (ON TYPED TEXT)
# -----------------------------------------------------------------------------
async def handle_user_text_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Whenever a user types ANY message, search the library for matching content."""
    user = update.effective_user
    msg = update.effective_message
    if not msg or not msg.text:
        return

    # Check force-subscribe
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    query_text = msg.text.strip()
    if query_text.startswith("/"):
        return  # Handled by command handlers

    search_term = query_text.lower()
    products = await FirebaseRTDB.get_products()

    # Match search keywords
    matches = []
    for p in products:
        p_title = (p.get("title") or "").lower()
        p_desc = (p.get("desc") or "").lower()
        p_cat = (p.get("category") or "").lower()

        # Score matching
        if search_term in p_title or p_title in search_term:
            matches.append((p, 3))
        elif any(word in p_title for word in search_term.split() if len(word) > 2):
            matches.append((p, 2))
        elif search_term in p_desc or search_term in p_cat:
            matches.append((p, 1))

    # Sort by relevance score
    matches.sort(key=lambda x: x[1], reverse=True)
    results = [item[0] for item in matches[:8]]

    if not results:
        no_res_text = (
            f"🔍 <b>No material found matching:</b> <i>'{html.escape(query_text)}'</i>\n\n"
            "💡 Don't worry! Our library is community-driven. You can submit a request right now "
            "and our admins will upload it for you!"
        )
        keyboard = [
            [InlineKeyboardButton(f"➕ Request '{query_text[:20]}'", callback_data=f"req_prefill:{query_text[:30]}")],
            [InlineKeyboardButton("📚 Browse All Categories", callback_data="nav:categories")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
        ]
        await msg.reply_text(no_res_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # If exactly 1 match found, send the full product card directly!
    if len(results) == 1:
        p = results[0]
        title = p.get("title", "Untitled")
        category = p.get("category", "General")
        desc = p.get("desc", "Direct cloud link ready.")
        img_url = p.get("imgUrl", "").strip()

        caption = (
            f"🎯 <b>Match Found: {html.escape(title)}</b>\n"
            f"🏷️ <b>Category:</b> <code>{html.escape(category)}</code>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📝 <b>Description:</b>\n{html.escape(desc)}\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "⚡ <i>Click GET NOW below to download directly:</i>"
        )
        keyboard = get_product_card_keyboard(p, user.id)

        if img_url and img_url.startswith("http"):
            try:
                await msg.reply_photo(photo=img_url, caption=caption, parse_mode=constants.ParseMode.HTML, reply_markup=keyboard)
                return
            except Exception:
                pass

        await msg.reply_text(caption, parse_mode=constants.ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)
        return

    # If multiple matches found, render interactive search result list
    res_text = (
        f"🔍 <b>Found {len(results)} materials matching:</b> <i>'{html.escape(query_text)}'</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "👇 <i>Select an item below to view and download:</i>\n\n"
    )

    buttons = []
    for idx, p in enumerate(results, start=1):
        title = p.get("title", "Untitled")
        cat = p.get("category", "Other")
        res_text += f"<b>{idx}.</b> {html.escape(title)} <code>[{html.escape(cat)}]</code>\n"
        buttons.append([
            InlineKeyboardButton(f"📥 #{idx} {title[:28]}", callback_data=f"view_prod:{p['id']}")
        ])

    buttons.append([InlineKeyboardButton("➕ Request Another Material", callback_data="nav:request")])
    buttons.append([InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")])

    await msg.reply_text(res_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(buttons))

# -----------------------------------------------------------------------------
# 9. REQUEST MATERIAL FLOW (CONVERSATION HANDLER)
# -----------------------------------------------------------------------------
async def start_request_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    prefill = ""
    if query and query.data.startswith("req_prefill:"):
        prefill = query.data.split("req_prefill:")[1].strip()

    prompt = (
        "➕ <b>Request Study Material or Software</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "Can't find the notes, book, APK, or tool you need? Let our team know!\n\n"
        "👉 <b>Step 1/3:</b> What is the <b>Name / Title</b> of the material you need?\n"
        "<i>(Send /cancel anytime to abort)</i>"
    )

    if prefill:
        context.user_data["req_name"] = prefill
        cat_prompt = (
            f"📦 <b>Material Name:</b> <code>{html.escape(prefill)}</code>\n\n"
            "👉 <b>Step 2/3:</b> Select the category for this item:"
        )
        cat_keyboard = [
            [
                InlineKeyboardButton("Study Material", callback_data="req_cat:Study Material"),
                InlineKeyboardButton("Notes & PDFs", callback_data="req_cat:Notes"),
            ],
            [
                InlineKeyboardButton("APK / Android", callback_data="req_cat:APK"),
                InlineKeyboardButton("Software (PC/Mac)", callback_data="req_cat:Software"),
            ],
            [
                InlineKeyboardButton("Tools & Utilities", callback_data="req_cat:Tools"),
                InlineKeyboardButton("Other", callback_data="req_cat:Other"),
            ],
        ]
        if query:
            await query.edit_message_text(cat_prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(cat_keyboard))
        return REQ_CATEGORY

    if query:
        await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    elif update.effective_message:
        await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REQ_NAME

async def request_name_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    item_name = update.effective_message.text.strip()
    if len(item_name) < 2:
        await update.effective_message.reply_text("Please enter a valid material name (at least 2 characters):")
        return REQ_NAME

    context.user_data["req_name"] = item_name

    cat_prompt = (
        f"📦 <b>Material:</b> <code>{html.escape(item_name)}</code>\n\n"
        "👉 <b>Step 2/3:</b> Choose the category for this item:"
    )
    cat_keyboard = [
        [
            InlineKeyboardButton("Study Material", callback_data="req_cat:Study Material"),
            InlineKeyboardButton("Notes & PDFs", callback_data="req_cat:Notes"),
        ],
        [
            InlineKeyboardButton("APK / Android", callback_data="req_cat:APK"),
            InlineKeyboardButton("Software (PC/Mac)", callback_data="req_cat:Software"),
        ],
        [
            InlineKeyboardButton("Tools & Utilities", callback_data="req_cat:Tools"),
            InlineKeyboardButton("Other", callback_data="req_cat:Other"),
        ],
    ]
    await update.effective_message.reply_text(cat_prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(cat_keyboard))
    return REQ_CATEGORY

async def request_cat_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    category = query.data.split("req_cat:")[1]
    context.user_data["req_category"] = category

    prompt = (
        f"🏷️ <b>Category:</b> <code>{html.escape(category)}</code>\n\n"
        "👉 <b>Step 3/3:</b> Provide any additional details (Author, Semester, Version, Subject, etc.):\n"
        "<i>(Or send <code>none</code> if no details)</i>"
    )
    await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REQ_DETAILS

async def request_details_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    details = update.effective_message.text.strip()
    if details.lower() == "none":
        details = ""

    user = update.effective_user
    req_name = context.user_data.get("req_name", "Untitled")
    req_category = context.user_data.get("req_category", "Study Material")

    payload = {
        "itemName": req_name,
        "userName": user.full_name or user.username or f"User_{user.id}",
        "category": req_category,
        "details": details,
        "status": "pending",
        "adminReply": "",
        "timestamp": int(time.time() * 1000),
        "telegramUserId": user.id,
        "telegramUsername": f"@{user.username}" if user.username else "",
    }

    req_id = await FirebaseRTDB.post("requests", payload)
    ticket_no = req_id[-6:].upper() if req_id else "SUBMITTED"

    confirm_text = (
        "🎉 <b>Request Submitted Successfully!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎫 <b>Ticket ID:</b> <code>#REQ-{ticket_no}</code>\n"
        f"📦 <b>Item:</b> {html.escape(req_name)}\n"
        f"🏷️ <b>Category:</b> {html.escape(req_category)}\n"
        f"📝 <b>Details:</b> {html.escape(details or 'None')}\n"
        f"⏳ <b>Status:</b> <code>Pending Admin Review</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "🔔 <i>You will receive a notification DM from this bot as soon as an admin approves or replies to your request!</i>"
    )
    keyboard = [
        [InlineKeyboardButton("📋 Track My Requests", callback_data="nav:activity")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await update.effective_message.reply_text(confirm_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))

    # Alert all active bot admins
    admin_alert = (
        f"🔔 <b>New Item Request Alert!</b>\n\n"
        f"From: {html.escape(user.full_name)} ({payload['telegramUsername']})\n"
        f"Item: <b>{html.escape(req_name)}</b> [{req_category}]\n"
        f"Details: {html.escape(details)}\n"
        f"Ticket: <code>#REQ-{ticket_no}</code>"
    )
    for admin_id in ADMIN_USER_IDS:
        try:
            btn = InlineKeyboardMarkup([[InlineKeyboardButton("💬 Reply & Approve", callback_data=f"adm_rep_req:{req_id}")]])
            await context.bot.send_message(chat_id=admin_id, text=admin_alert, parse_mode=constants.ParseMode.HTML, reply_markup=btn)
        except Exception:
            pass

    context.user_data.clear()
    return ConversationHandler.END

async def cancel_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.effective_message.reply_text("❌ Action cancelled. Returning to main menu.", reply_markup=get_main_menu_keyboard())
    return ConversationHandler.END

# -----------------------------------------------------------------------------
# 10. REPORT ISSUE FLOW (CONVERSATION HANDLER)
# -----------------------------------------------------------------------------
async def start_report_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    pid = ""
    if query and query.data.startswith("report_item:"):
        pid = query.data.split("report_item:")[1].strip()
        context.user_data["rep_pid"] = pid

    prompt = (
        "⚠️ <b>Report Broken File or Problem</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "👉 <b>Step 1/2:</b> What is the reason for your report?\n\n"
        "1️⃣ Broken or inaccessible download link\n"
        "2️⃣ Outdated or wrong material\n"
        "3️⃣ Corrupted file / password issue\n"
        "4️⃣ Other issue\n\n"
        "<i>(Select a button below or type your custom reason):</i>"
    )
    keyboard = [
        [InlineKeyboardButton("🔗 Broken Download Link", callback_data="rep_reason:Broken Link")],
        [InlineKeyboardButton("📦 Outdated / Wrong File", callback_data="rep_reason:Outdated File")],
        [InlineKeyboardButton("🔒 Corrupted / Password Issue", callback_data="rep_reason:Corrupted File")],
        [InlineKeyboardButton("❌ Cancel", callback_data="nav:menu")],
    ]

    if query:
        await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
    elif update.effective_message:
        await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
    return REP_REASON

async def report_reason_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    reason = query.data.split("rep_reason:")[1]
    context.user_data["rep_reason"] = reason

    prompt = (
        f"📌 <b>Reason:</b> <code>{html.escape(reason)}</code>\n\n"
        "👉 <b>Step 2/2:</b> Please provide details or the name of the affected material:"
    )
    await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REP_DETAILS

async def report_reason_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["rep_reason"] = update.effective_message.text.strip()
    prompt = "👉 <b>Step 2/2:</b> Please provide specific details about what happened:"
    await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REP_DETAILS

async def report_details_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    details = update.effective_message.text.strip()
    user = update.effective_user
    pid = context.user_data.get("rep_pid", "GENERAL")
    reason = context.user_data.get("rep_reason", "General Issue")

    # Fetch product title if pid exists
    prod_title = "General Report"
    if pid != "GENERAL":
        products = await FirebaseRTDB.get_all_products_raw()
        p = next((x for x in products if x.get("id") == pid), None)
        if p:
            prod_title = p.get("title", "Material")

    payload = {
        "productId": pid,
        "productTitle": prod_title,
        "userName": user.full_name or user.username or f"User_{user.id}",
        "reason": reason,
        "issue": details,
        "status": "pending",
        "adminReply": "",
        "timestamp": int(time.time() * 1000),
        "telegramUserId": user.id,
        "telegramUsername": f"@{user.username}" if user.username else "",
    }

    rep_id = await FirebaseRTDB.post("reports", payload)
    ticket_no = rep_id[-6:].upper() if rep_id else "REP-OK"

    confirm_text = (
        "🚨 <b>Issue Report Received!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎫 <b>Ticket ID:</b> <code>#REP-{ticket_no}</code>\n"
        f"📦 <b>Material:</b> {html.escape(prod_title)}\n"
        f"📌 <b>Reason:</b> {html.escape(reason)}\n"
        f"📝 <b>Details:</b> {html.escape(details)}\n"
        f"⏳ <b>Status:</b> <code>Under Investigation</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "🙏 <i>Thank you for helping keep UNICORN GOODS clean and verified!</i>"
    )
    keyboard = [
        [InlineKeyboardButton("📋 My Reports Status", callback_data="nav:activity")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await update.effective_message.reply_text(confirm_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))

    # Alert admins
    for admin_id in ADMIN_USER_IDS:
        try:
            alert = (
                f"🚨 <b>New Bug/Issue Report!</b>\n\n"
                f"Item: {html.escape(prod_title)}\n"
                f"Reason: {html.escape(reason)}\n"
                f"Issue: {html.escape(details)}\n"
                f"User: {html.escape(user.full_name)} ({payload['telegramUsername']})\n"
                f"Ticket: <code>#REP-{ticket_no}</code>"
            )
            await context.bot.send_message(chat_id=admin_id, text=alert, parse_mode=constants.ParseMode.HTML)
        except Exception:
            pass

    context.user_data.clear()
    return ConversationHandler.END

# -----------------------------------------------------------------------------
# 11. USER ACTIVITY, SAVED GOODS & ABOUT INFO
# -----------------------------------------------------------------------------
async def render_text_response(target, text: str, reply_markup=None) -> None:
    """Renders text response whether target is a CallbackQuery or a Message object."""
    if hasattr(target, "edit_message_text"):
        try:
            await target.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)
            return
        except Exception:
            pass
    if hasattr(target, "reply_text"):
        await target.reply_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)
    elif hasattr(target, "message") and hasattr(target.message, "reply_text"):
        await target.message.reply_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)

async def show_user_activity(target, user_id: int) -> None:
    # 1. Fetch user requests
    raw_reqs = await FirebaseRTDB.get("requests") or {}
    user_reqs = []
    for rid, rdata in raw_reqs.items():
        if isinstance(rdata, dict) and rdata.get("telegramUserId") == user_id:
            rdata["id"] = rid
            user_reqs.append(rdata)
    user_reqs.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # 2. Fetch user reports
    raw_reps = await FirebaseRTDB.get("reports") or {}
    user_reps = []
    for rid, rdata in raw_reps.items():
        if isinstance(rdata, dict) and rdata.get("telegramUserId") == user_id:
            rdata["id"] = rid
            user_reps.append(rdata)
    user_reps.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    text = (
        "📋 <b>Your Activity & Request Status Tracker</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )

    if not user_reqs and not user_reps:
        text += (
            "<i>You haven't submitted any requests or reports yet.</i>\n\n"
            "💡 Use <b>➕ Request Item</b> to request any book, note, or tool!"
        )
    else:
        if user_reqs:
            text += "<b>📦 YOUR REQUESTS:</b>\n"
            for idx, r in enumerate(user_reqs[:5], start=1):
                status = r.get("status", "pending").lower()
                status_icon = "🟢" if status == "approved" else ("🔴" if status == "rejected" else "⏳")
                reply = r.get("adminReply", "").strip()
                text += (
                    f"<b>{idx}. {html.escape(r.get('itemName', 'Item'))}</b>\n"
                    f"   Status: {status_icon} <b>{status.upper()}</b>\n"
                )
                if reply:
                    text += f"   💬 <i>Admin: {html.escape(reply)}</i>\n"
                text += "\n"

        if user_reps:
            text += "<b>⚠️ YOUR REPORTS:</b>\n"
            for idx, rep in enumerate(user_reps[:5], start=1):
                status = rep.get("status", "pending").lower()
                status_icon = "🟢" if status in ["resolved", "approved"] else "⏳"
                text += (
                    f"<b>{idx}. {html.escape(rep.get('productTitle', 'Issue'))}</b>\n"
                    f"   Status: {status_icon} <b>{status.upper()}</b>\n"
                )
                if rep.get("adminReply"):
                    text += f"   💬 <i>Admin: {html.escape(rep['adminReply'])}</i>\n"
                text += "\n"

    keyboard = [
        [InlineKeyboardButton("➕ Submit New Request", callback_data="nav:request")],
        [InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")],
    ]
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(keyboard))

async def show_saved_goods(target, user_id: int) -> None:
    raw_saved = await FirebaseRTDB.get(f"bot_saved/{user_id}") or {}
    if not raw_saved:
        text = (
            "⭐ <b>Your Saved Goods</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>You have no saved materials yet.</i>\n\n"
            "💡 When viewing any material, click the <b>⭐ Save</b> button to bookmark it here!"
        )
        keyboard = [
            [InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
        ]
        await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    all_products = await FirebaseRTDB.get_all_products_raw()
    saved_items = [p for p in all_products if p.get("id") in raw_saved]

    text = (
        f"⭐ <b>Your Saved Goods ({len(saved_items)} items)</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    buttons = []
    for idx, p in enumerate(saved_items, start=1):
        title = p.get("title", "Untitled")
        cat = p.get("category", "General")
        text += f"<b>{idx}. {html.escape(title)}</b> <code>[{html.escape(cat)}]</code>\n"
        buttons.append([
            InlineKeyboardButton(f"📥 #{idx} {title[:28]}", callback_data=f"view_prod:{p['id']}")
        ])

    buttons.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")])
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def show_about_info(target) -> None:
    about = await FirebaseRTDB.get("settings/about") or {}
    branding = await FirebaseRTDB.get("settings/branding") or {}

    title = about.get("title") or branding.get("brandTitle") or "About UNICORN GOODS"
    tagline = about.get("tagline") or branding.get("brandTagline") or "Curated Free Digital Library"
    content = about.get("content", "A community-driven digital download library providing verified textbooks, lecture notes, APKs, and desktop utilities with high-speed direct downloads.")
    version = about.get("version", "v2.4.0")
    contact_link = about.get("contactLink") or REQUIRED_CHANNEL_URL
    contact_text = about.get("contactText") or "Join Community & Support ↗"

    text = (
        f"🦄 <b>{html.escape(title)}</b> [<code>{html.escape(version)}</code>]\n"
        f"✨ <i>{html.escape(tagline)}</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{html.escape(content)}\n\n"
        "⚡ <b>Key Features:</b>\n"
        "• Direct Cloud Links (No URL shorteners, no countdowns)\n"
        "• 100% Free & Verified materials\n"
        "• Community Requests & Reports actively monitored by admins\n\n"
        f"📢 <b>Official Channel:</b> {REQUIRED_CHANNEL}"
    )

    buttons = [
        [InlineKeyboardButton(contact_text, url=contact_link)],
        [InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")],
    ]
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def show_announcements(target) -> None:
    popup = await FirebaseRTDB.get("settings/popup") or {}
    p_title = popup.get("title", "Announcement")
    p_msg = popup.get("message", "No announcements at this time. Stay tuned for updates!")
    p_link = popup.get("link", "").strip()
    p_link_text = popup.get("linkText", "Check It Out ↗").strip()

    text = (
        f"📢 <b>{html.escape(p_title)}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{html.escape(p_msg)}\n"
    )

    buttons = []
    if p_link and p_link.startswith("http"):
        buttons.append([InlineKeyboardButton(p_link_text or "Explore Now ↗", url=p_link)])
    buttons.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")])

    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    query_text = " ".join(context.args).strip() if context.args else ""
    if query_text:
        update.effective_message.text = query_text
        await handle_user_text_search(update, context)
    else:
        text = (
            "🔍 <b>Universal Material Search</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "Simply type ANY book, note, app or tool name directly into this chat!\n\n"
            "<i>Or search with:</i> <code>/search &lt;item name&gt;</code>\n\n"
            "⚡ <i>Go ahead and type whatever you are looking for!</i>"
        )
        await update.effective_message.reply_text(
            text,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")]])
        )

async def activity_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_user_activity(update.effective_message, user.id)

async def saved_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_saved_goods(update.effective_message, user.id)

async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_about_info(update.effective_message)

async def announcement_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_announcements(update.effective_message)

# -----------------------------------------------------------------------------
# 12. GLOBAL CALLBACK QUERY DISPATCHER
# -----------------------------------------------------------------------------
async def callback_dispatcher(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    data = query.data
    user = query.from_user

    if data == "noop":
        await query.answer()
        return

    # Verify membership callback
    if data == "verify_membership":
        is_member = await check_channel_membership(user.id, context.bot)
        if is_member:
            await query.answer("🎉 Verification successful! Welcome to UNICORN GOODS.", show_alert=True)
            welcome_text = (
                f"👋 <b>Welcome, {html.escape(user.first_name)}!</b>\n\n"
                "🦄 <b>UNICORN GOODS Main Menu</b>\n"
                "<i>Curated Free Digital Download Hub</i>\n\n"
                "👇 Choose a category or browse all materials below:"
            )
            await query.edit_message_text(
                welcome_text,
                parse_mode=constants.ParseMode.HTML,
                reply_markup=get_main_menu_keyboard(),
            )
        else:
            await query.answer("⚠️ You have not joined the channel yet! Please join first.", show_alert=True)
        return

    # Force-subscribe check for all other actions
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    # Navigation actions
    if data == "nav:menu" or data == "nav:categories":
        await query.answer()
        text = (
            "🦄 <b>UNICORN GOODS — Categories & Explorer</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "👇 <i>Select a category to browse high-speed direct downloads:</i>"
        )
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=get_main_menu_keyboard())

    elif data.startswith("cat:"):
        await query.answer()
        category = data.split("cat:")[1]
        await render_category_page(query, category, 0, user.id)

    elif data.startswith("page:"):
        await query.answer()
        _, cat, page_str = data.split(":")
        await render_category_page(query, cat, int(page_str), user.id)

    elif data.startswith("view_prod:"):
        pid = data.split("view_prod:")[1]
        await show_product_detail(update, pid)

    elif data.startswith("save:"):
        pid = data.split("save:")[1]
        curr = await FirebaseRTDB.get(f"bot_saved/{user.id}/{pid}")
        if curr:
            await FirebaseRTDB.put(f"bot_saved/{user.id}/{pid}", None)
            await query.answer("Removed from your Saved Goods ⭐", show_alert=False)
        else:
            await FirebaseRTDB.put(f"bot_saved/{user.id}/{pid}", True)
            await query.answer("Saved to your Saved Goods ⭐! View anytime via /saved", show_alert=True)

    elif data == "nav:activity":
        await query.answer()
        await show_user_activity(query, user.id)

    elif data == "nav:saved":
        await query.answer()
        await show_saved_goods(query, user.id)

    elif data == "nav:about":
        await query.answer()
        await show_about_info(query)

    elif data == "nav:popup":
        await query.answer()
        await show_announcements(query)

    elif data == "nav:search":
        await query.answer()
        text = (
            "🔍 <b>Universal Material Search</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "Simply type ANY book, note, app or tool name directly into this chat!\n\n"
            "<i>Examples to try:</i>\n"
            "• <code>NEET PYQs</code>\n"
            "• <code>Capcut Pro</code>\n"
            "• <code>Vanced YT</code>\n"
            "• <code>Kinemaster</code>\n"
            "• <code>Vardaan Cinema</code>\n\n"
            "⚡ <i>Go ahead and type whatever you are looking for!</i>"
        )
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")]]))

# -----------------------------------------------------------------------------
# 13. AUTOMATED LIVE NOTIFICATION BACKGROUND WORKER
# -----------------------------------------------------------------------------
async def notification_worker(app) -> None:
    """Runs continuously in the background to deliver real-time Telegram DMs to users when admins reply to requests/reports."""
    logger.info("Notification worker started.")
    await asyncio.sleep(10)

    while True:
        try:
            # 1. Check Requests for Status/Reply Updates
            requests_raw = await FirebaseRTDB.get("requests")
            if requests_raw and isinstance(requests_raw, dict):
                for rid, rdata in requests_raw.items():
                    if not isinstance(rdata, dict):
                        continue
                    tg_user_id = rdata.get("telegramUserId")
                    if not tg_user_id:
                        continue

                    status = rdata.get("status", "pending")
                    reply = rdata.get("adminReply", "").strip()
                    cache_key = f"{status}_{reply}"

                    # If status or reply changed from pending
                    if rid in NOTIFIED_REQUEST_STATUS:
                        if NOTIFIED_REQUEST_STATUS[rid] != cache_key and status != "pending":
                            NOTIFIED_REQUEST_STATUS[rid] = cache_key
                            # Send notification DM
                            msg = (
                                "🔔 <b>Update on your UNICORN GOODS Request!</b>\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"📦 <b>Item:</b> {html.escape(rdata.get('itemName', 'Item'))}\n"
                                f"📌 <b>Status:</b> <b>{status.upper()}</b>\n"
                            )
                            if reply:
                                msg += f"💬 <b>Admin Note:</b> {html.escape(reply)}\n"
                            msg += (
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                "💡 <i>Type the item name in chat anytime to download!</i>"
                            )
                            try:
                                await app.bot.send_message(chat_id=tg_user_id, text=msg, parse_mode=constants.ParseMode.HTML)
                            except Exception as e:
                                logger.debug(f"Failed sending request DM to {tg_user_id}: {e}")
                    else:
                        NOTIFIED_REQUEST_STATUS[rid] = cache_key

            # 2. Check Reports for Resolution Updates
            reports_raw = await FirebaseRTDB.get("reports")
            if reports_raw and isinstance(reports_raw, dict):
                for rid, rdata in reports_raw.items():
                    if not isinstance(rdata, dict):
                        continue
                    tg_user_id = rdata.get("telegramUserId")
                    if not tg_user_id:
                        continue

                    status = rdata.get("status", "pending")
                    reply = rdata.get("adminReply", "").strip()
                    cache_key = f"{status}_{reply}"

                    if rid in NOTIFIED_REPORT_STATUS:
                        if NOTIFIED_REPORT_STATUS[rid] != cache_key and status != "pending":
                            NOTIFIED_REPORT_STATUS[rid] = cache_key
                            msg = (
                                "✅ <b>Your UNICORN GOODS Report has been Resolved!</b>\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"📦 <b>Material:</b> {html.escape(rdata.get('productTitle', 'Item'))}\n"
                                f"📌 <b>Status:</b> <b>{status.upper()}</b>\n"
                            )
                            if reply:
                                msg += f"💬 <b>Admin Resolution:</b> {html.escape(reply)}\n"
                            msg += "━━━━━━━━━━━━━━━━━━━━━━\n🙏 <i>Thank you for keeping our library verified!</i>"
                            try:
                                await app.bot.send_message(chat_id=tg_user_id, text=msg, parse_mode=constants.ParseMode.HTML)
                            except Exception as e:
                                logger.debug(f"Failed sending report DM to {tg_user_id}: {e}")
                    else:
                        NOTIFIED_REPORT_STATUS[rid] = cache_key

        except Exception as e:
            logger.debug(f"Worker iteration notice: {e}")

        await asyncio.sleep(25)

# -----------------------------------------------------------------------------
# 15. MAIN INITIALIZATION
# -----------------------------------------------------------------------------
def main() -> None:
    """Builds and starts the UNICORN GOODS Telegram bot application."""
    if not BOT_TOKEN or "AAHYV5pFGGXjpbjqv8ZdUqKslZDh7CBKqGk" not in BOT_TOKEN:
        logger.error("Invalid or missing BOT_TOKEN.")

    logger.info("Initializing UNICORN GOODS Telegram Bot...")

    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # 1. Request Flow (ConversationHandler)
    request_conv = ConversationHandler(
        entry_points=[
            CommandHandler("request", start_request_flow),
            CallbackQueryHandler(start_request_flow, pattern="^nav:request$"),
            CallbackQueryHandler(start_request_flow, pattern="^req_prefill:"),
        ],
        states={
            REQ_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, request_name_received)],
            REQ_CATEGORY: [CallbackQueryHandler(request_cat_received, pattern="^req_cat:")],
            REQ_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, request_details_received)],
        },
        fallbacks=[CommandHandler("cancel", cancel_flow)],
        per_message=False,
    )

    # 2. Report Flow (ConversationHandler)
    report_conv = ConversationHandler(
        entry_points=[
            CommandHandler("report", start_report_flow),
            CallbackQueryHandler(start_report_flow, pattern="^report_item:"),
        ],
        states={
            REP_REASON: [
                CallbackQueryHandler(report_reason_button, pattern="^rep_reason:"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, report_reason_text),
            ],
            REP_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, report_details_received)],
        },
        fallbacks=[CommandHandler("cancel", cancel_flow)],
        per_message=False,
    )

    # Register Conversation Handlers FIRST
    application.add_handler(request_conv)
    application.add_handler(report_conv)

    # Basic Commands
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("menu", start_command))
    application.add_handler(CommandHandler("search", search_command))
    application.add_handler(CommandHandler("activity", activity_command))
    application.add_handler(CommandHandler("saved", saved_command))
    application.add_handler(CommandHandler("about", about_command))
    application.add_handler(CommandHandler("announcement", announcement_command))
    application.add_handler(CommandHandler("announcements", announcement_command))
    application.add_handler(CommandHandler("help", help_command))

    # Callback Query Dispatcher
    application.add_handler(CallbackQueryHandler(callback_dispatcher))

    # Universal Text Auto-Search Handler (Any text message)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_user_text_search))

    # Start background notification worker and register Telegram Bot menu commands
    async def post_init(app):
        try:
            await app.bot.set_my_commands([
                BotCommand("start", "Open main menu & explore materials"),
                BotCommand("menu", "Browse materials by category"),
                BotCommand("search", "Search books, notes, APKs & tools"),
                BotCommand("request", "Request missing study material or app"),
                BotCommand("report", "Report a broken link or issue"),
                BotCommand("activity", "Track your requests & admin replies"),
                BotCommand("saved", "View your bookmarked goods"),
                BotCommand("about", "About UNICORN GOODS & community"),
                BotCommand("announcement", "View latest updates & notices"),
                BotCommand("help", "Bot guide & command instructions"),
            ])
            logger.info("Bot commands successfully registered with Telegram API.")
        except Exception as e:
            logger.warning(f"Could not auto-register bot commands: {e}")
        asyncio.create_task(notification_worker(app))

    application.post_init = post_init

    logger.info("Bot is ready. Starting polling...")
    application.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
