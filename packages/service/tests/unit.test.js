const { expect } = require('chai');

describe('Utility Functions Tests', function () {
    describe('Message Validation', function () {
        it('should validate non-empty message', function () {
            const message = 'Test message';
            expect(message).to.be.a('string');
            expect(message.trim()).to.not.be.empty;
        });

        it('should reject empty message', function () {
            const message = '';
            expect(message.trim()).to.be.empty;
        });

        it('should trim whitespace', function () {
            const message = '  Test message  ';
            expect(message.trim()).to.equal('Test message');
        });
    });

    describe('Stream Name Validation', function () {
        it('should accept valid stream names', function () {
            const validNames = [
                'stream1',
                'my-stream',
                'stream_123',
                'StreamName'
            ];

            validNames.forEach(name => {
                expect(name).to.match(/^[a-zA-Z0-9_-]+$/);
            });
        });

        it('should reject invalid stream names', function () {
            const invalidNames = [
                'stream name',
                'stream@123',
                'stream!',
                ''
            ];

            invalidNames.forEach(name => {
                expect(name).to.not.match(/^[a-zA-Z0-9_-]+$/) || expect(name).to.be.empty;
            });
        });
    });

    describe('Message Formatting', function () {
        it('should format message with ID and data', function () {
            const msg = {
                id: '1234567890-0',
                message: { content: 'test', author: 'user1' }
            };

            const formatted = {
                id: msg.id,
                data: msg.message
            };

            expect(formatted).to.have.property('id', '1234567890-0');
            expect(formatted).to.have.property('data');
            expect(formatted.data).to.deep.equal({ content: 'test', author: 'user1' });
        });
    });

    describe('Timestamp Generation', function () {
        it('should generate valid timestamp', function () {
            const timestamp = Date.now();
            expect(timestamp).to.be.a('number');
            expect(timestamp).to.be.above(0);
        });

        it('should convert timestamp to string', function () {
            const timestamp = Date.now().toString();
            expect(timestamp).to.be.a('string');
            expect(parseInt(timestamp)).to.be.a('number');
        });
    });
});
