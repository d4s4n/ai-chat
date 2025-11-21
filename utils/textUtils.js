function clearBadSymbols(text) {
    if (typeof text !== 'string') return text;
    let cleanedText = text.replace(/(?![\u0030-\u0039])[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]/gu, '');
    cleanedText = cleanedText.replace(/(?![\u0030-\u0039])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, '');
    return cleanedText.replace(/\s+/g, ' ').trim();
}

module.exports = { clearBadSymbols };