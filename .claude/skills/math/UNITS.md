# Unit Reference — `convert` tool

## Supported Unit Categories

### Length

| Unit          | Aliases               |
| ------------- | --------------------- |
| Meter         | `m`, `cm`, `mm`, `km` |
| Mile          | `mi`, `mile`, `miles` |
| Yard          | `yd`                  |
| Foot          | `ft`                  |
| Inch          | `inch`, `in`          |
| Nautical mile | `nmi`                 |

### Mass

| Unit     | Aliases         |
| -------- | --------------- |
| Kilogram | `kg`, `g`, `mg` |
| Pound    | `lb`            |
| Ounce    | `oz`            |
| Ton      | `ton`           |
| Stone    | `stone`         |

### Volume

| Unit        | Aliases                         |
| ----------- | ------------------------------- |
| Liter       | `liter`, `litre`, `litres`, `L` |
| Milliliter  | `ml`, `mL`                      |
| Gallon      | `gal`                           |
| Pint        | `pint`                          |
| Cup         | `cup`                           |
| Fluid ounce | `floz`                          |

### Temperature

| Unit       | Code   | Alias        |
| ---------- | ------ | ------------ |
| Celsius    | `degC` | `celsius`    |
| Fahrenheit | `degF` | `fahrenheit` |
| Kelvin     | `K`    |              |
| Rankine    | `degR` |              |

### Speed

| Unit                | Code                        |
| ------------------- | --------------------------- |
| Meters per second   | `m/s`                       |
| Kilometers per hour | `km/h`, `kph`, `kmh`        |
| Miles per hour      | `mph`                       |
| Knots               | `knot`, `knots`, `kn`, `kt` |

### Time

| Unit   | Code   |
| ------ | ------ |
| Second | `s`    |
| Minute | `min`  |
| Hour   | `h`    |
| Day    | `day`  |
| Week   | `week` |

### Area

| Unit             | Code     | Alias              |
| ---------------- | -------- | ------------------ |
| Square meter     | `m^2`    | `square meters`    |
| Square foot      | `ft^2`   | `square feet`      |
| Square kilometer | `km^2`   | `square kilometers`|
| Square mile      | `mile^2` | `square miles`     |

### Data

| Unit     | Code            |
| -------- | --------------- |
| Byte     | `byte`, `bytes` |
| Kilobyte | `kB`            |
| Megabyte | `MB`            |
| Gigabyte | `GB`            |
| Terabyte | `TB`            |
| Bit      | `b`             |
| Kilobit  | `kb`            |
| Megabit  | `Mb`            |
| Gigabit  | `Gb`            |

## Natural Language Aliases

Case-insensitive, normalized automatically:

| You can say...        | Converted to |
| --------------------- | ------------ |
| `celsius`             | `degC`       |
| `fahrenheit`          | `degF`       |
| `kilometers per hour` | `km/hour`    |
| `miles per hour`      | `mile/hour`  |
| `square meters`       | `m^2`        |
| `square feet`         | `ft^2`       |
| `cubic meters`        | `m^3`        |
| `cubic feet`          | `ft^3`       |
| `litres`              | `liter`      |

## Incompatible Units

Both units must measure the same quantity. Converting between different quantities (e.g., `kg` to `km`) returns an error.
