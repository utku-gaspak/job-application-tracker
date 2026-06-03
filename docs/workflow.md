# Workflow

```text
+-------------------+
|   User logs in    |
+-------------------+
          |
          v
+-----------------------------+
|   Mission tour may open     |
| - first login: once         |
| - demo user: every login    |
+-----------------------------+
          |
          v
+-----------------------------+
|         Dashboard           |
|  Tracker  |  Scout  |Search |
+-----------------------------+
     |            |        |
     |            |        +---------------------------+
     |            |                                    |
     |            v                                    v
     |     +-------------------+             +----------------------+
     |     |       Scout        |             |  HiringCafe Search   |
     |     | upload/evaluate    |             |  start scrape job    |
     |     +-------------------+             +----------------------+
     |            |                                    |
     |            | save / discard                     |
     |            v                                    |
     |     +-------------------+                      |
     |     |   Apply queue     |                      |
     |     +-------------------+                      |
     |            |                                    |
     |            v                                    |
     |     +-------------------+                      |
     |     |   Tracker board   |                      |
     |     | Applied / Interviewing / Rejected / Offer |
     |     +-------------------+                      |
     |                                                 |
     |                                                 v
     |                                     +----------------------+
     |                                     | backend worker runs  |
     |                                     | cafe-scout via uv    |
     |                                     +----------------------+
     |                                                 |
     |                 +-------------------------------+------------------+
     |                 |                               |                  |
     |                 v                               v                  v
     |       +----------------+              +----------------+   +----------------+
     |       | jobs.json      |              | jobs.md       |   | progress.json  |
     |       +----------------+              +----------------+   +----------------+
     |                 |                               |                  |
     |                 +---------------+---------------+------------------+
     |                                 |
     |                                 v
     |                    +---------------------------+
     |                    | Import new jobs into Scout |
     |                    +---------------------------+
     |                                 |
     +---------------------------------+-------------------------------+
                                       |
                                       v
                              +-------------------+
                              | Back to Tracker   |
                              | or Scout results  |
                              +-------------------+
```

Scrape results are imported only when they are new for the current user. The import checks
Scout review jobs, saved/apply jobs, discarded jobs, and Tracker applications before adding
rows back into Scout.
