const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }

    const { name, email, telephone, sujet, message } = JSON.parse(event.body);

    // Simple validation
    if (!name || !email || !telephone || !sujet || !message) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'All fields are required' })
        };
    }

    // Send confirmation email using Netlify's email service
    const transporter = nodemailer.createTransport({
        service: 'Netlify',
        auth: {
            user: 'your-email@example.com', // replace with your email
            pass: 'your-email-password', // replace with your email password
        },
    });

    const mailOptions = {
        from: 'from@example.com', // sender address
        to: email, // list of receivers
        subject: 'Contact Form Submission Confirmation', // Subject line
        text: `Dear ${name},\n\nThank you for your message regarding '${sujet}'. We have received your submission and will get back to you shortly.\n\nBest,\nYour Company`, // plain text body
    };

    try {
        await transporter.sendMail(mailOptions);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Confirmation email sent successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error sending email', error: error.message })
        };
    }
};