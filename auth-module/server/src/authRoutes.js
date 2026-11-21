import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { pool } from "./db.js";

const router = Router();
const passwordIsValid = p => typeof p === "string" && p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const transporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});

router.post("/request-otp", async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    if (!username || username.length > 40) return res.status(400).json({error:"Enter a username of 1–40 characters."});
    if (!validEmail(email)) return res.status(400).json({error:"Enter a valid email address."});
    if (!passwordIsValid(password)) return res.status(400).json({error:"Password must be 8+ characters and include uppercase, lowercase, a number and a symbol."});
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return res.status(503).json({error:"Email delivery is not configured. Add SMTP settings to server/.env."});
    const [existing] = await pool.query("SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1", [username,email]);
    if (existing.length) return res.status(409).json({error:"That username or email is already registered."});
    const [pending] = await pool.query("SELECT resend_after FROM pending_registrations WHERE email = ? LIMIT 1", [email]);
    if (pending.length && new Date(pending[0].resend_after).getTime() > Date.now()) return res.status(429).json({error:"Please wait before requesting another OTP."});
    const otp = String(crypto.randomInt(1000,10000));
    const otpHash = await bcrypt.hash(otp, 10);
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(`INSERT INTO pending_registrations (username,email,password_hash,otp_hash,expires_at,resend_after,attempts)
      VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE),DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 SECOND),0)
      ON DUPLICATE KEY UPDATE username=VALUES(username),password_hash=VALUES(password_hash),otp_hash=VALUES(otp_hash),expires_at=VALUES(expires_at),resend_after=VALUES(resend_after),attempts=0`,
      [username,email,passwordHash,otpHash]);
    try {
      await transporter().sendMail({from:process.env.MAIL_FROM || process.env.SMTP_USER,to:email,subject:"Your Currency Tracker verification code",text:`Your verification code is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`});
    } catch (mailError) {
      await pool.query("DELETE FROM pending_registrations WHERE email = ?",[email]);
      throw mailError;
    }
    res.json({message:"Verification code sent."});
  } catch (error) { next(error); }
});

router.post("/verify-register", async (req,res,next) => {
  const connection = await pool.getConnection();
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    const otp = String(req.body.otp || "");
    if (!/^\d{4}$/.test(otp)) return res.status(400).json({error:"Enter the 4-digit OTP sent to your email."});
    if (!passwordIsValid(password)) return res.status(400).json({error:"Password does not meet the required rules."});
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM pending_registrations WHERE email = ? FOR UPDATE",[email]);
    if (!rows.length) { await connection.rollback(); return res.status(400).json({error:"Request a new OTP to continue."}); }
    const pending = rows[0];
    if (new Date(pending.expires_at).getTime() <= Date.now()) { await connection.query("DELETE FROM pending_registrations WHERE email = ?",[email]); await connection.commit(); return res.status(400).json({error:"OTP expired. Request a new one."}); }
    if (pending.attempts >= 5) { await connection.query("DELETE FROM pending_registrations WHERE email = ?",[email]); await connection.commit(); return res.status(429).json({error:"Too many incorrect attempts. Request a new OTP."}); }
    const matches = await bcrypt.compare(otp,pending.otp_hash);
    if (!matches) { await connection.query("UPDATE pending_registrations SET attempts = attempts + 1 WHERE email = ?",[email]); await connection.commit(); return res.status(400).json({error:"Incorrect OTP. Please check the code in your email."}); }
    if (pending.username !== username || !(await bcrypt.compare(password,pending.password_hash))) { await connection.rollback(); return res.status(400).json({error:"Registration details do not match the OTP request. Request a new OTP."}); }
    const [dupes] = await connection.query("SELECT id FROM users WHERE username = ? OR email = ?",[username,email]);
    if (dupes.length) { await connection.rollback(); return res.status(409).json({error:"That username or email is already registered."}); }
    await connection.query("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)",[username,email,pending.password_hash]);
    await connection.query("DELETE FROM pending_registrations WHERE email = ?",[email]);
    await connection.commit();
    res.status(201).json({message:"Account created successfully."});
  } catch(error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

router.post("/login", async (req,res,next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = req.body.password;
    if (!username || typeof password !== "string") return res.status(400).json({error:"Enter your username and password."});
    const [rows] = await pool.query("SELECT id,username,password_hash FROM users WHERE username = ? LIMIT 1",[username]);
    if (!rows.length || !(await bcrypt.compare(password,rows[0].password_hash))) return res.status(401).json({error:"Incorrect username or password."});
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({error:"Authentication secret is not configured. Set JWT_SECRET in server/.env."});
    const token = jwt.sign({sub:String(rows[0].id),username:rows[0].username},process.env.JWT_SECRET,{expiresIn:"12h"});
    res.json({token,username:rows[0].username});
  } catch(error) { next(error); }
});

export default router;
