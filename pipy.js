pipy({
  _g: {
    ready: false, //whether to proceed request and stop healthcheck
    started: false, //whether to start healthcheck
    lastAccessTimestamp: Date.now(),
  },
  _target: `127.0.0.1:${os.env.TARGET_PORT || 3000}`,
  _targetEntry: os.env.TARGET_ENTRY,
  _targetHealthEndpoint: null, 
})

.listen(8080)
  .demuxHTTP('request')

.pipeline('request')
  .merge('start-target', '', {maxIdle: +os.env.MAX_IDLE_TIME || 60}) //max idle time
  .wait(
    () => (
      !Boolean(_targetHealthEndpoint) && (_g.ready = true),
      _g.ready
    )
  )
  .link('forward')

.pipeline('forward')
  .handleMessageStart(
    () => _g.lastAccessTimestamp = Date.now()
  )
  .muxHTTP(
    'connection',
    () => _target
  )

.pipeline('connection')
  .connect(
    () => _target,
    {
      retryCount: -1,
      retryDelay: '0.01s',
    }
  )

.pipeline('start-target')
  .handleStreamEnd(
    () => (
      // reset flag after idle
      _g.started = false,
      _g.ready = false
    )
  )
  .replaceMessage(
    () => (
      _g.started = true,
      new Message()
    )
  )
  .exec(() => _targetEntry)
  // .print() 

.task('0.01s')
  .link(
    'healthcheck', () => _targetHealthEndpoint && _g.started && !_g.ready,
    ''
    )
    .replaceMessage(
      new StreamEnd
    )

.pipeline('healthcheck')
  .replaceMessage(
    () => (
      console.log('====start health check'),
      new Message({
        path: _targetHealthEndpoint,
        method: 'GET',
        headers: {
          "host": _target,
          "user-agent": "curl/7.64.1",
          "accept": "application/json",
          'accept-encoding': 'gzip',
        },
      }, '')
    )
  )
  .link('forward')
  .handleMessageStart(
    msg => (
      console.log(JSON.stringify(msg.head)),
      msg?.head.status == 200 && (_g.ready = true)
      ,console.log(`_g.ready: ${JSON.stringify(_g.ready)}`)
    )
  )
  

// for debug only
.task('1s')
  .handleMessageStart(
    () => (
      console.log('idleTimeInSeconds', _g.ready ? (Date.now() - _g.lastAccessTimestamp) / 1000 : 0, 'ready', _g.ready)
    )
  )
  .replaceMessage(
    new StreamEnd
  )
