(function() {
  const storage = require('fifo')();

  const acceptOffer = function(offer) {
    offer.accept(function(err) {
      if (!err) {
        return true;
      }
      return false;
    });
  };

  const acceptPending = function() {
    if (storage.length <= 0) {
      return;
    }
    storage.forEach(function(offer, node) {
      if (acceptOffer(offer)) {
        storage.remove(node);
      }
    });
  };

  setInterval(acceptPending, 2 * 1000);

  module.exports = storage;
});