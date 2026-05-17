import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const LegalPrivacy = () => {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const sections = [
        {
            title: "1. Who We Are",
            content: `This website is operated by DailyDate ("we", "us", "our"), with its office at Mau, Uttar Pradesh – 275101, India.\n\nThis Privacy Policy describes how we collect, use, store, and protect your personal data when you use the DailyDate mobile application and website (collectively, the "Platform"). By using the Platform, you consent to the practices described here. If you do not agree, please stop using the Platform immediately.`
        },
        {
            title: "2. Information We Collect",
            content: `We collect the following categories of information:\n\n• Identity & Profile Data: Your name, age, gender, photographs, and bio that you voluntarily provide during registration and profile creation.\n• Contact & Authentication Data: Your mobile number (for OTP verification) and email address (for account recovery and receipts). Your mobile number is never displayed to other users.\n• Usage Data: Your swipe history, likes, matches, message activity, session duration, and in-app behaviour, used to improve our matching algorithms.\n• Payment Data: Transaction IDs and payment status from Google Play Billing. We do not store full card numbers, CVVs, or UPI PINs — these are handled entirely by our secure payment processor.\n• Camera Access: The app may request access to your device camera to allow you to capture and upload photos (e.g., profile pictures or content uploads). We do not access your camera without your explicit action, and no images are stored or shared outside the app without your consent.\n• Communications: Chat messages exchanged between users, stored securely and retained for up to 90 days for safety and moderation purposes in case of reported incidents.`
        },
        {
            title: "3. How We Use Your Information",
            content: `We use your data for the following purposes:\n\n• To create and manage your account and verify your identity via OTP;\n• To facilitate matching, messaging, and other core platform features;\n• To personalise your experience and suggest compatible matches based on your preferences and location (city/area only — precise GPS coordinates are never shared with other users);\n• To process payments for premium subscriptions and send payment receipts;\n• To monitor for fraudulent, abusive, or suspicious activity and enforce our Community Guidelines;\n• To enable camera functionality for capturing and uploading images within the app;\n• To send transactional notifications such as new matches, messages, and account alerts;\n• To comply with legal obligations, court orders, or requests from law enforcement authorities;\n• To improve and develop the Platform through anonymised analytics.`
        },
        {
            title: "4. Data Sharing & Third Parties",
            content: `We do not sell, rent, or trade your personal data to any third party for marketing purposes.\n\nData may be shared only in the following limited circumstances:\n\n• Service Providers: Trusted third-party vendors (hosting, OTP delivery, payment processing) who are contractually bound to process data only on our behalf and in accordance with our instructions;\n• Legal Compliance: If required by applicable Indian law (including the IT Act, 2000, and DPDP Act, 2023), court orders, or regulatory authorities;\n• Safety: When we reasonably believe disclosure is necessary to protect the safety or rights of any user or third party.`
        },
        {
            title: "5. Data Retention",
            content: `We retain your personal data only for as long as necessary to provide our services or as required by law:\n\n• Active account data is retained for the duration of your account;\n• Chat messages are retained for up to 90 days after the conversation, for safety review purposes;\n• Upon account deletion, all personal data is permanently purged from our active systems within 48 hours, subject to legal retention obligations (e.g., records related to abuse reports or payment disputes);\n• Payment transaction records are retained for 7 years as required by Indian financial and taxation laws.`
        },
        {
            title: "6. Your Rights Under DPDP Act, 2023",
            content: `In accordance with India's Digital Personal Data Protection Act, 2023, you have the following rights:\n\n• Right of Access: Request a copy of the personal data we hold about you;\n• Right to Correction: Request correction of inaccurate or incomplete personal data;\n• Right to Erasure: Request deletion of your account and all associated data;\n• Support & Redressal: Reach out directly to DailyDate for any concerns.\n\nTo exercise any of these rights, contact us at dailydateapp@gmail.com. We will respond within 24-48 hours of receiving your request.`
        },
        {
            title: "7. Security",
            content: `We implement industry-standard technical and organisational security measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. These include:\n\n• Encrypted data transmission (HTTPS/TLS);\n• Hashed and salted password storage;\n• OTP-based authentication;\n• Access controls limiting data access to authorised personnel only.\n\nHowever, no method of electronic transmission or storage is 100% secure. In the event of a data breach affecting your rights, we will notify you as required by applicable law.`
        },
        {
            title: "8. Children's Privacy",
            content: `DailyDate is strictly intended for users aged 18 and above. We do not knowingly collect personal data from individuals under 18 years of age. If we become aware that a minor has registered on the platform, we will immediately suspend the account and permanently delete all associated data.`
        },
        {
            title: "9. Changes to This Policy",
            content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make material changes, we will notify you via in-app notification or email. Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.`
        },
        {
            title: "10. Reach Us Directly",
            content: `For any privacy-related queries, data requests, or complaints:\n\nContact: DailyDate Team\nEmail: dailydateapp@gmail.com\nAddress: Mau, Uttar Pradesh – 275101, India\nResponse Time: Within 24-48 hours of receipt.`
        }
    ];

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-orange-500/10 pt-[72px]">
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-0 right-0 w-[50%] h-[50%] rounded-full blur-[150px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 lg:py-32">
                <header className="mb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-600 hover:text-orange-500 transition-colors mb-12 group">
                        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>


                    <h1 className="font-serif text-5xl lg:text-7xl font-black mb-4 tracking-tight">
                        Privacy <br />
                        <span className="text-orange-500">Policy.</span>
                    </h1>
                    <p className="text-zinc-500 text-sm mb-2">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: May 9, 2026</p>
                    <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                        This website is operated by <strong>DailyDate</strong>. We are committed to protecting your personal data in compliance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and all applicable Indian privacy regulations.
                    </p>
                </header>

                <div className="space-y-5 mb-16">
                    {sections.map((section, idx) => (
                        <section key={idx} className="bg-zinc-50 border border-zinc-100 rounded-2xl p-7 lg:p-10 hover:border-orange-500/20 transition-colors">
                            <h2 className="text-lg lg:text-xl font-bold mb-4 text-zinc-900">{section.title}</h2>
                            <p className="text-zinc-500 leading-relaxed text-sm lg:text-[15px] whitespace-pre-line font-light">
                                {section.content}
                            </p>
                        </section>
                    ))}
                </div>

                {/* CTA */}
                <section className="bg-orange-500 rounded-2xl p-10 text-zinc-950 font-medium mb-16">
                    <h2 className="text-2xl font-black mb-3">Privacy Questions?</h2>
                    <p className="mb-6 opacity-80 text-sm leading-relaxed max-w-lg">
                        DailyDate is available to answer any questions regarding your personal data, your rights under the DPDP Act, 2023, or any privacy concerns you may have.
                    </p>
                    <a href="mailto:dailydateapp@gmail.com" className="text-xl font-black block hover:translate-x-2 transition-transform underline decoration-4 underline-offset-8">
                        dailydateapp@gmail.com
                    </a>
                    <p className="mt-4 text-xs opacity-60">
                        DailyDate | Mau, Uttar Pradesh – 275101, India
                    </p>
                </section>

                <div className="border-t border-zinc-100 pt-8 text-center text-zinc-400 text-xs space-y-1">
                    <p className="font-bold text-zinc-700">© 2026 DailyDate. All rights reserved.</p>
                    <p>Mau, Uttar Pradesh – 275101, India</p>
                    <p className="opacity-50">Last updated: May 9, 2026</p>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default LegalPrivacy;
