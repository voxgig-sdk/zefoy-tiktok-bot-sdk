# ZefoyTiktokBot SDK configuration

module ZefoyTiktokBotConfig
  # Return the process-wide config, built once on first use. The SDK reads
  # the config on every request and never writes to it, so one instance is
  # shared by every client rather than rebuilt per client.
  #
  # The returned hash is shared: treat it as read-only. Callers that need to
  # mutate should use make_config, which always returns a fresh copy.
  def self.shared_config
    @shared_config ||= make_config
  end


  # Build a fresh, fully materialised config hash. Every call rebuilds the
  # whole structure, so prefer shared_config unless you need a private copy
  # you intend to mutate.
  def self.make_config
    {
      "main" => {
        "name" => "ZefoyTiktokBot",
        "slug" => "zefoy-tiktok-bot",
        "version" => "0.0.1",
        "target" => "rb",
      },
      "feature" => {
        "test" => {
          "options" => {
            "active" => false,
          },
          "transport" => "base",
        },
      },
      "options" => {
        "base" => "https://zefoy.com",
        "auth" => {
          "prefix" => "",
        },
        "headers" => {
          "content-type" => "application/json",
        },
        "entity" => {
          "engagement" => {},
        },
      },
      "entity" => {
        "engagement" => {
          "fields" => [
            {
              "name" => "amount",
              "short" => "The amount of engagement to acquire (if applicable)",
              "type" => "`$INTEGER`",
            },
            {
              "name" => "estimatedTime",
              "short" => "Estimated time to complete in seconds",
              "type" => "`$INTEGER`",
            },
            {
              "name" => "message",
              "short" => "Response message",
              "type" => "`$STRING`",
            },
            {
              "name" => "status",
              "short" => "Current status of the boost request",
              "type" => "`$STRING`",
            },
            {
              "name" => "success",
              "short" => "Indicates if the request was successful",
              "type" => "`$BOOLEAN`",
            },
            {
              "name" => "type",
              "op" => {
                "create" => {
                  "req" => true,
                  "type" => "`$STRING`",
                },
              },
              "short" => "The type of engagement boosted",
              "type" => "`$STRING`",
            },
            {
              "name" => "url",
              "req" => true,
              "short" => "The TikTok video or profile URL to boost",
              "type" => "`$STRING`",
            },
          ],
          "name" => "engagement",
          "op" => {
            "create" => {
              "input" => "data",
              "name" => "create",
              "points" => [
                {
                  "args" => {},
                  "kind" => "http",
                  "method" => "POST",
                  "orig" => "/api/boost",
                  "parts" => [
                    "api",
                    "boost",
                  ],
                  "select" => {},
                  "transform" => {
                    "req" => "`reqdata`",
                    "res" => "`body`",
                  },
                },
              ],
            },
          },
          "relations" => {
            "ancestors" => [],
          },
        },
      },
    }
  end


  def self.make_feature(name)
    require_relative 'features'
    ZefoyTiktokBotFeatures.make_feature(name)
  end
end
