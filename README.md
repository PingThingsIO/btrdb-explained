_The Berkeley Tree DataBase (BTrDB) is pronounced "**Better DB**"._

# BTrDB

__A next-gen timeseries database for high-precision, high-sample-rate telemetry.__

__Problem:__ Existing timeseries databases are poorly equipped for a new
generation of ultra-fast sensor telemetry. Specifically, millions of
high-precision power meters are to be deployed throughout the power grid to help
analyze and prevent blackouts. Thus, new software must be built to facilitate
the storage and analysis of its data.

__Baseline:__ We need 1.4M inserts/s and 5x that in reads if we are to support
1000 [micro-synchrophasors] per server node.  No timeseries database can do
this.

[micro-synchrophasors]:https://arxiv.org/abs/1605.02813

## Summary

__Goals:__ Develop a multi-resolution storage and query engine for many 100+ Hz
streams at nanosecond precision—and operate at the full line rate of
underlying network or storage infrastructure for affordable cluster sizes (less
than six).

Developed at Berkeley, BTrDB offers new ways to support the aforementioned high
throughput demands and allows efficient querying over large ranges.

**Fast writes/reads**

Measured on a 4-node cluster (large EC2 nodes):

- 53 million inserted values per second
- 119 million queried values per second

**Fast analysis**

In under _200ms_, it can query a year of data at nanosecond-precision (2.1
trillion points) at any desired window—returning statistical summary points at any
desired resolution (containing a min/max/mean per point).

```
TODO: insert GIF of a plotter zooming into a year of data
```

**High compression**

Data is compressed by 2.93x—a significant improvement for high-precision
nanosecond streams. To achieve this, a modified version of _run-length encoding_
was created to encode the _jitter_ of delta values rather than the delta values
themselves.  Incidentally, this  outperforms the popular audio codec [FLAC]
which was the original inspiration for this technique.

[FLAC]:https://xiph.org/flac/

**Efficient Versioning**

Data is version-annotated to allow queries of data as it existed at a certain
time.  This allows reproducible query results that might otherwise change due
to newer realtime data coming in.  Structural sharing of data between versions
is done to make this process as efficient as possible.

## Implementation Details

BTrDB introduces a new abstraction and data structure.

...

## Appendix

This page is written based on the following sources:

- [Homepage](http://btrdb.io/)
- [Whitepaper](https://www.usenix.org/system/files/conference/fast16/fast16-papers-andersen.pdf)
- [Code](https://github.com/BTrDB/btrdb-server)
