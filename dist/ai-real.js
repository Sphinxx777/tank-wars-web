// The Pascal Real format has 39 stored fraction bits. These scoped helpers
// reproduce the runtime polynomial reductions used by the aiming routines.
export function real(value) {
  if (!value || !Number.isFinite(value)) return value;
  const unit = 2 ** (Math.floor(Math.log2(Math.abs(value))) - 39);
  return Math.sign(value) * Math.round(Math.abs(value) / unit) * unit;
}
const add = (a, b) => real(a + b);
const mul = (a, b) => real(a * b);
const div = (a, b) => real(a / b);
const halfPi = 1.5707963267941523;
function polynomial(x, coefficients) {
  let result = coefficients[0];
  for (let i = 0; i < coefficients.length; i++) {
    if (i) result = add(result, coefficients[i]);
    result = mul(result, x);
  }
  return add(result, 1);
}
function atanSmall(x) {
  return mul(
    x,
    polynomial(
      mul(x, x),
      [
        -0.09090909090900823, 0.11111111111108585, -0.14285714285711038, 0.20000000000004547,
        -0.3333333333334849,
      ],
    ),
  );
}
export function realAtan(value) {
  const negative = value < 0;
  let x = Math.abs(value),
    inverted = x >= 1;
  if (inverted) x = div(1, x);
  let result;
  if (x < 0.13714566164935604) result = atanSmall(x);
  else {
    const [t, angle] =
      x < 0.4142135623728791
        ? [0.2679491924309332, 0.26179938779841905]
        : x < 0.7673269879787767
          ? [0.5773502691899921, 0.5235987755968381]
          : [1, 0.7853981633970761];
    result = add(atanSmall(div(add(x, -t), add(mul(x, t), 1))), angle);
  }
  if (inverted) result = add(halfPi, -result);
  return negative ? -result : result;
}
export function realSin(value) {
  return mul(
    value,
    polynomial(
      mul(value, value),
      [
        -7.647163731813581e-13, 1.6059043836812987e-10, -2.505210305636706e-8,
        2.7557319223978083e-6, -0.0001984126984126977, 0.008333333333325754, -0.16666666666674246,
      ],
    ),
  );
}
export function realCos(value) {
  return realSin(add(halfPi, -value));
}
export { add as realAdd, mul as realMultiply, div as realDivide };
