/* ============================================================
   CIRCUIT BREAKER - for calls to a dependency that can be down
   ------------------------------------------------------------
   Wraps a promise-returning call. After N consecutive failures that look like
   the DEPENDENCY is unhealthy, the breaker opens and every further call fails
   instantly for a cooldown, instead of each one waiting out a timeout. After
   the cooldown one trial call is allowed through; if it succeeds the breaker
   closes, if it fails the cooldown starts again.

   Written for `analyzeWriting`, the Gemini call behind Writing AI. That call
   has no retry and no timeout of its own, so during a Gemini outage a teacher
   clicking Analyze waits out the Firebase callable default (about 70 seconds)
   with a dead button - and the server tries up to three models in sequence
   first, so the real wait can be far worse.

   WHICH FAILURES COUNT (the part that is easy to get wrong)
   Only failures that mean "the dependency is unhealthy". A teacher without the
   Writing AI permission gets permission-denied; a teacher who has spent their
   Deep quota gets resource-exhausted. Those are correct, per-user, permanent
   answers. Counting them would let ONE teacher hitting their cap open the
   breaker and lock the feature for everybody else. They pass straight through,
   uncounted.

   State lives in memory, per tab, on purpose. Persisting an open breaker would
   mean a student or teacher opening a fresh tab after the outage ended still
   gets told the service is down.
   ============================================================ */
(function () {
  'use strict';

  if (window.CircuitBreaker) return;

  // Firebase callable error codes that are the CALLER's situation, not the
  // dependency failing. See the note above.
  var USER_FAULT = [
    'permission-denied',    // Writing AI not enabled for this account
    'resource-exhausted',   // this teacher's Deep cap is spent
    'unauthenticated',      // signed out
    'invalid-argument',     // bad payload
    'failed-precondition',  // e.g. the Gemini key is not configured at all
    'not-found',
    'already-exists',
    'cancelled'             // the user navigated away
  ];

  function isDependencyFailure(err) {
    if (!err) return true;
    if (err.__cbTimeout) return true;                   // our own timeout
    var code = String(err.code || '').replace(/^functions\//, '');
    if (USER_FAULT.indexOf(code) !== -1) return false;
    return true;
  }

  function Breaker(name, opts) {
    opts = opts || {};
    this.name = name;
    this.threshold = opts.failureThreshold || 4;
    this.cooldownMs = opts.cooldownMs || 60000;
    this.timeoutMs = opts.timeoutMs || 25000;
    this.onStateChange = opts.onStateChange || null;

    this.state = 'closed';      // closed | open | half-open
    this.failures = 0;
    this.openedAt = 0;
    this.trialInFlight = false;
  }

  Breaker.prototype._set = function (s) {
    if (this.state === s) return;
    this.state = s;
    if (this.onStateChange) {
      try { this.onStateChange(s, this); } catch (_) {}
    }
  };

  // Milliseconds until the breaker will next allow a trial call. 0 when it is
  // not open. Used to tell the user when to come back.
  Breaker.prototype.retryInMs = function () {
    if (this.state !== 'open') return 0;
    return Math.max(0, this.cooldownMs - (Date.now() - this.openedAt));
  };

  Breaker.prototype._succeed = function () {
    this.failures = 0;
    this.trialInFlight = false;
    this._set('closed');
  };

  Breaker.prototype._fail = function (err) {
    this.trialInFlight = false;
    if (!isDependencyFailure(err)) return;   // caller's problem, not the service's
    this.failures++;
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.openedAt = Date.now();
      this._set('open');
    }
  };

  function timeoutError(name, ms) {
    var e = new Error(name + ' did not respond within ' + Math.round(ms / 1000) + ' seconds.');
    e.code = 'deadline-exceeded';
    e.__cbTimeout = true;
    return e;
  }

  function openError(b) {
    var secs = Math.ceil(b.retryInMs() / 1000);
    var e = new Error('Writing AI is temporarily unavailable. Please try again in about '
                    + (secs > 60 ? Math.ceil(secs / 60) + ' minutes' : secs + ' seconds') + '.');
    e.code = 'unavailable';
    e.__cbOpen = true;
    e.retryInMs = b.retryInMs();
    return e;
  }

  // task must be a function returning a promise.
  Breaker.prototype.run = function (task) {
    var self = this;

    if (this.state === 'open') {
      if (this.retryInMs() > 0) return Promise.reject(openError(this));
      this._set('half-open');                 // cooldown is up, allow one trial
    }
    if (this.state === 'half-open' && this.trialInFlight) {
      // A trial is already out. Everyone else keeps failing fast rather than
      // piling onto a dependency we are not yet sure has recovered.
      return Promise.reject(openError(this));
    }
    if (this.state === 'half-open') this.trialInFlight = true;

    var settled = false;
    var timer = null;

    return new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        var e = timeoutError(self.name, self.timeoutMs);
        self._fail(e);
        reject(e);
      }, self.timeoutMs);

      Promise.resolve()
        .then(task)
        .then(function (v) {
          if (settled) return;               // the timeout already rejected
          settled = true;
          clearTimeout(timer);
          self._succeed();
          resolve(v);
        })
        .catch(function (e) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          self._fail(e);
          reject(e);
        });
    });
  };

  var registry = {};

  window.CircuitBreaker = {
    get: function (name, opts) {
      if (!registry[name]) registry[name] = new Breaker(name, opts);
      return registry[name];
    },
    // Test seam: lets a harness start from a known state.
    _reset: function (name) {
      if (name) delete registry[name]; else registry = {};
    },
    isOpenError: function (e) { return !!(e && e.__cbOpen); },
    isTimeout: function (e) { return !!(e && e.__cbTimeout); }
  };
})();
