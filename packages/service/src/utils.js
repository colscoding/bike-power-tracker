const ensureString = (input) => {
    return typeof input === 'string' ? input : JSON.stringify(input);
}

module.exports = { ensureString };