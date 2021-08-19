/**
  --assets-url-map   Fixup map for assets url in response, use alongside 
                     --static to create full functional resource server.
                     required for below option.
  --assets-url-base  New assets url base, defaults to request host or 
                     `ASSETS_PREFIX` header if not set.
  --routers          Dir for custom logic for handling routes, happens before 
                     the json and after the path rewrite
  --config, -c       Path to config file           [default: "json-server.json"]
  --port, -p         Set port                                    [default: 3000]
  --host, -H         Set host                             [default: "localhost"]
  --watch, -w        Watch file(s)                                     [boolean]
  --routes, -r       Path to routes file
  --middlewares, -m  Paths to middleware files                           [array]
  --static, -s       Set static files directory
  --read-only, --ro  Allow only GET requests                           [boolean]
  --no-cors, --nc    Disable Cross-Origin Resource Sharing             [boolean]
  --no-gzip, --ng    Disable GZIP Content-Encoding                     [boolean]
  --snapshots, -S    Set snapshots directory                      [default: "."]
  --delay, -d        Add delay to responses (ms)
  --id, -i           Set database id property (e.g. _id)         [default: "id"]
  --foreignKeySuffix, --fks  Set foreign key suffix, (e.g. _id as in post_id)
                                                                 [default: "Id"]
  --quiet, -q        Suppress log messages from output                 [boolean]
  --help, -h         Show help                                         [boolean]
  --version, -v      Show version number                               [boolean]
 */