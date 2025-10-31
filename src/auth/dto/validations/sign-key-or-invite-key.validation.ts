import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function SignUpKeyOrInviteToken(
  otherProperty: 'registrationKey' | 'inviteToken',
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'UserOrEmailXor',
      target: object.constructor,
      propertyName,
      constraints: [otherProperty],
      options: {
        message: 'Provide exactly one of registrationKey or inviteToken',
        ...validationOptions,
      },
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [otherProp] = args.constraints as [string];
          const otherValue = (args.object as any)?.[otherProp];

          const hasThis =
            value !== undefined &&
            value !== null &&
            String(value).trim().length > 0;

          const hasOther =
            otherValue !== undefined &&
            otherValue !== null &&
            String(otherValue).trim().length > 0;

          return (hasThis || hasOther) && !(hasThis && hasOther);
        },
      },
    });
  };
}
