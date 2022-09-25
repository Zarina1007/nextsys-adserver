let state = {
    currentAllowedTraffic: 0,
    currentTotalTraffic: 0,
    currentRejectedTraffic: 0,
    probability: true,
};

const getState = () => state;

const setState = (s) => {
    state = Object.assign(state, s);
    return state;
};

module.exports = {
    getState,
    setState
}