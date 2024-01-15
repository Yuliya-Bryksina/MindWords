const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    dailyWordLimit: { type: Number, default: 10 },
    lastNewWordsRequest: { type: Date },
    dailyWordsList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Word" }],
    resetPasswordToken: { type: String }, // Токен для сброса пароля
    resetPasswordExpires: { type: Date }, // Время истечения токена
  },
  {
    timestamps: true,
  }
);

userSchema.methods.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
