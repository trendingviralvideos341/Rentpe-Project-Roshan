'use client';
import { useState } from 'react';
import { forgotPassword } from '@/actions/auth';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const result = await forgotPassword(formData);
        setLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            setSent(true);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
            padding: '24px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 8px 40px rgba(88,28,235,0.10)',
                border: '1px solid #ede9fe',
                padding: '40px 36px'
            }}>
                {sent ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '56px', marginBottom: '16px' }}>📧</div>
                        <h1 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 900, margin: '0 0 12px' }}>
                            Check Your Email
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.7, margin: '0 0 24px' }}>
                            If this email is registered, you'll receive a reset link shortly.
                            The link expires in <strong>30 minutes</strong>.
                        </p>
                        <a href="/login" style={{
                            display: 'inline-block',
                            color: '#7c3aed',
                            fontWeight: 700,
                            fontSize: '14px',
                            textDecoration: 'none'
                        }}>
                            ← Back to Login
                        </a>
                    </div>
                ) : (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
                            <h1 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 900, margin: '0 0 8px' }}>
                                Forgot Password?
                            </h1>
                            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                                Enter your email and we'll send you a secure reset link.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: '#374151',
                                    marginBottom: '6px'
                                }}>
                                    Email Address
                                </label>
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    required
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        padding: '0 14px',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    background: loading ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '15px',
                                    fontWeight: 800,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    marginTop: '8px',
                                }}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>

                        <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '24px' }}>
                            Remember your password?{' '}
                            <a href="/login" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>
                                Sign In
                            </a>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
